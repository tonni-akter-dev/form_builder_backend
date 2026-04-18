const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const Response = require("../models/Response");
const Form = require("../models/Form");
const auth = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
// ImgBB API Key
const IMGBB_API_KEY =
  process.env.IMGBB_API_KEY || "4e40960ee867d0115a4c0049f45f4572";

// Helper function to upload file to ImgBB
const uploadToImgBB = async (file) => {
  try {
    const formData = new FormData();
    formData.append("image", file.buffer.toString("base64"));
    formData.append("key", IMGBB_API_KEY);

    const response = await axios.post(
      "https://api.imgbb.com/1/upload",
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      },
    );

    if (response.data.success) {
      return response.data.data.url;
    } else {
      throw new Error(response.data.error?.message || "ImgBB upload failed");
    }
  } catch (error) {
    console.error("ImgBB upload error:", error);
    throw error;
  }
};

// Submit a response with file uploads
router.post("/", auth, upload.any(), async (req, res) => {
  try {
    const { formId, answers, timeSpent } = req.body;

    let parsedAnswers = answers;
    if (typeof answers === "string") {
      parsedAnswers = JSON.parse(answers);
    }

    console.log("Parsed answers:", JSON.stringify(parsedAnswers, null, 2));
    console.log("Files received:", req.files?.length || 0);

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    if (!form.isPublished) {
      return res.status(400).json({ error: "Form is not published" });
    }

    const existing = await Response.findOne({
      formId,
      submittedBy: req.user._id,
    });

    if (existing) {
      return res.status(400).json({
        error: "You have already submitted this exam",
      });
    }

    // Process file uploads to ImgBB
    const uploadedFileUrls = {};
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const match = file.fieldname.match(/files_(.+)_(\d+)/);
          if (match) {
            const fieldId = match[1];
            if (!uploadedFileUrls[fieldId]) {
              uploadedFileUrls[fieldId] = [];
            }
            const imgbbUrl = await uploadToImgBB(file);
            uploadedFileUrls[fieldId].push(imgbbUrl);
            console.log(`Uploaded file for field ${fieldId}: ${imgbbUrl}`);
          }
        } catch (error) {
          console.error(`Failed to upload file for ${file.fieldname}:`, error);
        }
      }
    }

    // Validate required fields
    const missingFields = form.fields
      .filter((field) => field.required)
      .filter((field) => {
        const answer = parsedAnswers.find(
          (a) => a.fieldId === field._id.toString(),
        );
        const hasFileUpload =
          uploadedFileUrls[field._id.toString()]?.length > 0;
        const hasAnswer = answer && answer.value && answer.value !== "";

        if (field.type === "image_text" || field.type === "file_upload") {
          return !hasAnswer && !hasFileUpload;
        }
        return !hasAnswer;
      });

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Required fields are missing",
        missingFields: missingFields.map((f) => f.label),
      });
    }

    // AUTO CHECK LOGIC
    let totalMarks = 0;
    let obtainedMarks = 0;
    let hasManualGrading = false;
    const evaluatedAnswers = [];

    for (const ans of parsedAnswers) {
      const field = form.fields.find(
        (f) => f._id.toString() === ans.fieldId.toString(),
      );

      if (!field) continue;

      const correctAnswer = field.correctAnswer;
      const marks = field.marks || 1;
      const needsManualGrading =
        field.type === "image_text" || field.type === "file_upload";
      const fileUrls = uploadedFileUrls[ans.fieldId] || ans.fileUrls || [];

      console.log(
        `Field ${ans.fieldId} - Manual: ${needsManualGrading}, Files: ${fileUrls.length}`,
      );

      totalMarks += marks;

      if (needsManualGrading) {
        hasManualGrading = true;
        evaluatedAnswers.push({
          fieldId: ans.fieldId,
          fieldLabel: ans.fieldLabel || field.label,
          value: ans.value || "",
          isCorrect: false,
          correctAnswer: correctAnswer,
          marksAwarded: 0,
          needsManualGrading: true,
          fileUrls: fileUrls,
        });
        continue;
      }

      let isCorrect = false;
      let marksAwarded = 0;

      switch (field.type) {
        case "checkbox":
          isCorrect =
            Array.isArray(ans.value) &&
            Array.isArray(correctAnswer) &&
            ans.value.sort().toString() === correctAnswer.sort().toString();
          break;
        case "number":
        case "rating":
          isCorrect = Number(ans.value) === Number(correctAnswer);
          break;
        case "radio":
        case "select":
          isCorrect = String(ans.value).trim() === String(correctAnswer).trim();
          break;
        default:
          isCorrect =
            String(ans.value || "")
              .trim()
              .toLowerCase() ===
            String(correctAnswer || "")
              .trim()
              .toLowerCase();
      }

      if (isCorrect) {
        marksAwarded = marks;
        obtainedMarks += marks;
      }

      evaluatedAnswers.push({
        fieldId: ans.fieldId,
        fieldLabel: ans.fieldLabel || field.label,
        value: ans.value,
        isCorrect,
        correctAnswer,
        marksAwarded,
        needsManualGrading: false,
        fileUrls: fileUrls,
      });
    }

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const resultStatus = hasManualGrading
      ? "pending"
      : percentage >= 40
        ? "pass"
        : "fail";

    const response = new Response({
      formId,
      className: form.className,
      subject: form.subject,
      answers: evaluatedAnswers,
      submittedBy: req.user._id,
      totalMarks,
      obtainedMarks,
      percentage,
      resultStatus,
      timeSpent: timeSpent || 0,
      ipAddress:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    });

    await response.save();
    await response.populate(
      "submittedBy",
      "username email fullName rollNumber className phoneNumber",
    );

    let message = "Response submitted successfully";
    if (hasManualGrading) {
      message =
        "Response submitted! Manual grading questions will be reviewed by the teacher.";
    }

    // Return the full response with answers and file URLs
    res.status(201).json({
      success: true,
      message,
      response: {
        id: response._id,
        totalMarks,
        obtainedMarks,
        percentage,
        resultStatus,
        hasManualGrading,
        answers: evaluatedAnswers, // Include the full answers with file URLs
      },
    });
  } catch (err) {
    console.error("Error submitting response:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get all responses for a specific form (admin only)
router.get("/:formId", auth, async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    const responses = await Response.find({ formId })
      .populate(
        "submittedBy",
        "username email fullName rollNumber className phoneNumber",
      )
      .sort({ submittedAt: -1 });

    const stats = {
      totalResponses: responses.length,
      averageScore: 0,
      passCount: 0,
      failCount: 0,
      pendingCount: 0,
      highestScore: 0,
      lowestScore: 100,
    };

    if (responses.length > 0) {
      let totalPercentage = 0;
      responses.forEach((response) => {
        totalPercentage += response.percentage || 0;
        if (response.resultStatus === "pass") stats.passCount++;
        if (response.resultStatus === "fail") stats.failCount++;
        if (response.resultStatus === "pending") stats.pendingCount++;
        const score = response.percentage || 0;
        if (score > stats.highestScore) stats.highestScore = score;
        if (score < stats.lowestScore) stats.lowestScore = score;
      });
      stats.averageScore = totalPercentage / responses.length;
    }

    res.json({
      success: true,
      count: responses.length,
      stats,
      responses,
    });
  } catch (err) {
    console.error("Error fetching responses:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get single response by ID (admin only)
router.get("/response/:responseId", auth, async (req, res) => {
  try {
    const { responseId } = req.params;

    const response = await Response.findById(responseId)
      .populate(
        "submittedBy",
        "username email fullName rollNumber className phoneNumber",
      )
      .populate(
        "formId",
        "title description className subject totalMarks duration fields",
      );

    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    res.json({
      success: true,
      response,
    });
  } catch (err) {
    console.error("Error fetching response:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get responses for a specific user
router.get("/user/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const responses = await Response.find({ submittedBy: userId })
      .populate(
        "formId",
        "title description subject className duration totalMarks",
      )
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: responses.length,
      responses,
    });
  } catch (err) {
    console.error("Error fetching user responses:", err);
    res.status(500).json({ error: err.message });
  }
});
// Batch update multiple answers (admin only)
// Batch update multiple answers with feedback (admin only)
router.put(
  "/:responseId/batch-evaluate",
  auth,
  auth.adminOnly,
  async (req, res) => {
    try {
      const { responseId } = req.params;
      const { updates, overallFeedback } = req.body;

      const response = await Response.findById(responseId);
      if (!response) {
        return res.status(404).json({ error: "Response not found" });
      }

      updates.forEach((update) => {
        const answerIndex = response.answers.findIndex(
          (a) => a.fieldId.toString() === update.fieldId,
        );
        if (answerIndex !== -1) {
          response.answers[answerIndex].marksAwarded = update.marksAwarded;
          response.answers[answerIndex].isCorrect = update.isCorrect;
          if (update.teacherFeedback) {
            response.answers[answerIndex].teacherFeedback =
              update.teacherFeedback;
          }
        }
      });

      if (overallFeedback) {
        response.overallFeedback = overallFeedback;
      }

      response.obtainedMarks = response.answers.reduce(
        (sum, a) => sum + (a.marksAwarded || 0),
        0,
      );
      response.percentage =
        (response.obtainedMarks / response.totalMarks) * 100;
      response.resultStatus = response.percentage >= 40 ? "pass" : "fail";

      await response.save();

      res.json({
        success: true,
        obtainedMarks: response.obtainedMarks,
        percentage: response.percentage,
        resultStatus: response.resultStatus,
        overallFeedback: response.overallFeedback,
      });
    } catch (err) {
      console.error("Error batch evaluating response:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
