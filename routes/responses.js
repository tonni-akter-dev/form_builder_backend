
// const express = require("express");
// const multer = require("multer");
// const axios = require("axios");
// const FormData = require("form-data");
// const Response = require("../models/Response");
// const Form = require("../models/Form");
// const auth = require("../middleware/auth");

// const router = express.Router();

// // Configure multer for memory storage
// const upload = multer({ storage: multer.memoryStorage() });

// // ImgBB API Key - should be in .env file
// const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "4e40960ee867d0115a4c0049f45f4572";

// // Helper function to upload file to ImgBB
// const uploadToImgBB = async (file) => {
//   try {
//     const formData = new FormData();
//     formData.append("image", file.buffer.toString("base64"));
//     formData.append("key", IMGBB_API_KEY);

//     const response = await axios.post("https://api.imgbb.com/1/upload", formData, {
//       headers: formData.getHeaders(),
//       timeout: 30000,
//     });

//     if (response.data.success) {
//       return response.data.data.url;
//     } else {
//       throw new Error(response.data.error?.message || "ImgBB upload failed");
//     }
//   } catch (error) {
//     console.error("ImgBB upload error:", error);
//     throw error;
//   }
// };

// // Submit a response with file uploads
// router.post("/", auth, upload.any(), async (req, res) => {
//   try {
//     const { formId, answers, timeSpent } = req.body;
    
//     // Parse answers if sent as JSON string
//     let parsedAnswers = answers;
//     if (typeof answers === "string") {
//       parsedAnswers = JSON.parse(answers);
//     }

//     // Get form
//     const form = await Form.findById(formId);
//     if (!form) {
//       return res.status(404).json({ error: "Form not found" });
//     }

//     if (!form.isPublished) {
//       return res.status(400).json({ error: "Form is not published" });
//     }

//     // Check if user has already submitted
//     const existing = await Response.findOne({
//       formId,
//       submittedBy: req.user._id,
//     });

//     if (existing) {
//       return res.status(400).json({
//         error: "You have already submitted this exam",
//       });
//     }

//     // Process file uploads to ImgBB
//     const uploadedFileUrls = {};
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         try {
//           // Extract fieldId from filename (format: files_fieldId_index)
//           const match = file.fieldname.match(/files_(.+)_(\d+)/);
//           if (match) {
//             const fieldId = match[1];
//             if (!uploadedFileUrls[fieldId]) {
//               uploadedFileUrls[fieldId] = [];
//             }
//             const imgbbUrl = await uploadToImgBB(file);
//             uploadedFileUrls[fieldId].push(imgbbUrl);
//           }
//         } catch (error) {
//           console.error(`Failed to upload file for ${file.fieldname}:`, error);
//         }
//       }
//     }

//     // Validate required fields
//     const missingFields = form.fields
//       .filter((field) => field.required)
//       .filter((field) => {
//         const answer = parsedAnswers.find(
//           (a) => a.fieldId === field._id.toString()
//         );
//         const hasFileUpload = uploadedFileUrls[field._id.toString()]?.length > 0;
//         const hasAnswer = answer && answer.value && answer.value !== "";
        
//         // For image_text and file_upload, check either answer or file upload
//         if (field.type === "image_text" || field.type === "file_upload") {
//           return !hasAnswer && !hasFileUpload;
//         }
//         return !hasAnswer;
//       });

//     if (missingFields.length > 0) {
//       return res.status(400).json({
//         error: "Required fields are missing",
//         missingFields: missingFields.map((f) => f.label),
//       });
//     }

//     // AUTO CHECK LOGIC
//     let totalMarks = 0;
//     let obtainedMarks = 0;
//     let hasManualGrading = false;
//     const evaluatedAnswers = [];

//     for (const ans of parsedAnswers) {
//       const field = form.fields.find(
//         (f) => f._id.toString() === ans.fieldId.toString()
//       );

//       if (!field) continue;

//       const correctAnswer = field.correctAnswer;
//       const marks = field.marks || 1;
//       const needsManualGrading = field.type === "image_text" || field.type === "file_upload";
//       const fileUrls = uploadedFileUrls[ans.fieldId] || [];

//       totalMarks += marks;

//       if (needsManualGrading) {
//         hasManualGrading = true;
//         evaluatedAnswers.push({
//           fieldId: ans.fieldId,
//           fieldLabel: ans.fieldLabel || field.label,
//           value: ans.value || "",
//           isCorrect: false,
//           correctAnswer: correctAnswer,
//           marksAwarded: 0,
//           needsManualGrading: true,
//           fileUrls: fileUrls,
//         });
//         continue;
//       }

//       let isCorrect = false;
//       let marksAwarded = 0;

//       // Type-based checking for auto-gradable questions
//       switch (field.type) {
//         case "checkbox":
//           isCorrect =
//             Array.isArray(ans.value) &&
//             Array.isArray(correctAnswer) &&
//             ans.value.sort().toString() === correctAnswer.sort().toString();
//           break;

//         case "number":
//           isCorrect = Number(ans.value) === Number(correctAnswer);
//           break;

//         case "rating":
//           isCorrect = Number(ans.value) === Number(correctAnswer);
//           break;

//         case "checkbox_grid":
//         case "multiple_choice_grid":
//           isCorrect =
//             JSON.stringify(ans.value) === JSON.stringify(correctAnswer);
//           break;

//         case "radio":
//         case "select":
//           isCorrect = String(ans.value).trim() === String(correctAnswer).trim();
//           break;

//         default:
//           isCorrect =
//             String(ans.value || "")
//               .trim()
//               .toLowerCase() ===
//             String(correctAnswer || "")
//               .trim()
//               .toLowerCase();
//       }

//       if (isCorrect) {
//         marksAwarded = marks;
//         obtainedMarks += marks;
//       }

//       evaluatedAnswers.push({
//         fieldId: ans.fieldId,
//         fieldLabel: ans.fieldLabel || field.label,
//         value: ans.value,
//         isCorrect,
//         correctAnswer,
//         marksAwarded,
//         needsManualGrading: false,
//         fileUrls: fileUrls,
//       });
//     }

//     const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
//     const resultStatus = hasManualGrading ? "pending" : (percentage >= 40 ? "pass" : "fail");

//     // SAVE RESPONSE
//     const response = new Response({
//       formId,
//       className: form.className,
//       subject: form.subject,
//       answers: evaluatedAnswers,
//       submittedBy: req.user._id,
//       totalMarks,
//       obtainedMarks,
//       percentage,
//       resultStatus,
//       timeSpent: timeSpent || 0,
//       ipAddress:
//         req.ip ||
//         req.headers["x-forwarded-for"] ||
//         req.connection.remoteAddress,
//       userAgent: req.get("User-Agent"),
//     });

//     await response.save();
//     await response.populate(
//       "submittedBy",
//       "username email fullName rollNumber className phoneNumber"
//     );

//     // RETURN RESULT
//     let message = "Response submitted successfully";
//     if (hasManualGrading) {
//       message = "Response submitted! Manual grading questions will be reviewed by the teacher.";
//     } else if (isCorrect) {
//       message = "Response submitted & evaluated successfully";
//     }

//     res.status(201).json({
//       success: true,
//       message,
//       response: {
//         id: response._id,
//         totalMarks,
//         obtainedMarks,
//         percentage,
//         resultStatus,
//         hasManualGrading,
//       },
//     });
//   } catch (err) {
//     console.error("Error submitting response:", err);
//     res.status(400).json({ error: err.message });
//   }
// });

// // Get all responses for a specific form (admin only)
// router.get("/:formId", auth, async (req, res) => {
//   try {
//     const { formId } = req.params;

//     const form = await Form.findById(formId);
//     if (!form) {
//       return res.status(404).json({ error: "Form not found" });
//     }

//     const responses = await Response.find({ formId })
//       .populate(
//         "submittedBy",
//         "username email fullName rollNumber className phoneNumber"
//       )
//       .sort({ submittedAt: -1 });

//     const stats = {
//       totalResponses: responses.length,
//       averageScore: 0,
//       passCount: 0,
//       failCount: 0,
//       pendingCount: 0,
//       highestScore: 0,
//       lowestScore: 100,
//     };

//     if (responses.length > 0) {
//       let totalPercentage = 0;

//       responses.forEach((response) => {
//         totalPercentage += response.percentage || 0;

//         if (response.resultStatus === "pass") stats.passCount++;
//         if (response.resultStatus === "fail") stats.failCount++;
//         if (response.resultStatus === "pending") stats.pendingCount++;

//         const score = response.percentage || 0;
//         if (score > stats.highestScore) stats.highestScore = score;
//         if (score < stats.lowestScore) stats.lowestScore = score;
//       });

//       stats.averageScore = totalPercentage / responses.length;
//     }

//     res.json({
//       success: true,
//       count: responses.length,
//       stats,
//       responses,
//     });
//   } catch (err) {
//     console.error("Error fetching responses:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get single response by ID (admin only)
// router.get("/response/:responseId", auth, async (req, res) => {
//   try {
//     const { responseId } = req.params;

//     const response = await Response.findById(responseId)
//       .populate(
//         "submittedBy",
//         "username email fullName rollNumber className phoneNumber"
//       )
//       .populate(
//         "formId",
//         "title description className subject totalMarks duration fields"
//       );

//     if (!response) {
//       return res.status(404).json({ error: "Response not found" });
//     }

//     res.json({
//       success: true,
//       response,
//     });
//   } catch (err) {
//     console.error("Error fetching response:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get responses for a specific user
// router.get("/user/:userId", auth, async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const responses = await Response.find({ submittedBy: userId })
//       .populate(
//         "formId",
//         "title description subject className duration totalMarks"
//       )
//       .sort({ submittedAt: -1 });

//     res.json({
//       success: true,
//       count: responses.length,
//       responses,
//     });
//   } catch (err) {
//     console.error("Error fetching user responses:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get response statistics for a form
// router.get("/:formId/stats", auth, async (req, res) => {
//   try {
//     const { formId } = req.params;

//     const responses = await Response.find({ formId });

//     const stats = {
//       totalResponses: responses.length,
//       averageScore: 0,
//       passCount: 0,
//       failCount: 0,
//       pendingCount: 0,
//       highestScore: 0,
//       lowestScore: 100,
//       scoreDistribution: {
//         "0-20": 0,
//         "21-40": 0,
//         "41-60": 0,
//         "61-80": 0,
//         "81-100": 0,
//       },
//     };

//     if (responses.length > 0) {
//       let totalPercentage = 0;

//       responses.forEach((response) => {
//         const percentage = response.percentage || 0;
//         totalPercentage += percentage;

//         if (response.resultStatus === "pass") stats.passCount++;
//         if (response.resultStatus === "fail") stats.failCount++;
//         if (response.resultStatus === "pending") stats.pendingCount++;

//         if (percentage > stats.highestScore) stats.highestScore = percentage;
//         if (percentage < stats.lowestScore) stats.lowestScore = percentage;

//         if (percentage <= 20) stats.scoreDistribution["0-20"]++;
//         else if (percentage <= 40) stats.scoreDistribution["21-40"]++;
//         else if (percentage <= 60) stats.scoreDistribution["41-60"]++;
//         else if (percentage <= 80) stats.scoreDistribution["61-80"]++;
//         else stats.scoreDistribution["81-100"]++;
//       });

//       stats.averageScore = totalPercentage / responses.length;
//     }

//     res.json(stats);
//   } catch (err) {
//     console.error("Error fetching stats:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Export responses to CSV (admin only)
// router.get("/:formId/export", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.formId);
//     if (!form) {
//       return res.status(404).json({ error: "Form not found" });
//     }

//     const responses = await Response.find({ formId: req.params.formId })
//       .populate("submittedBy", "username email fullName rollNumber className")
//       .sort({ submittedAt: -1 });

//     const headers = [
//       "Submission ID",
//       "Student Name",
//       "Student Email",
//       "Roll Number",
//       "Class",
//       "Submitted At",
//       "Time Spent (seconds)",
//       "Total Marks",
//       "Obtained Marks",
//       "Percentage",
//       "Result",
//       ...form.fields.map((f, index) => `${index + 1}. ${f.label}`),
//       ...form.fields.map((f, index) => `${index + 1}. ${f.label} (Files)`),
//     ];

//     const rows = responses.map((response) => {
//       const row = [
//         response._id,
//         response.submittedBy
//           ? response.submittedBy.fullName || response.submittedBy.username
//           : "Anonymous",
//         response.submittedBy ? response.submittedBy.email : "-",
//         response.submittedBy ? response.submittedBy.rollNumber || "-" : "-",
//         response.submittedBy ? response.submittedBy.className || "-" : "-",
//         response.submittedAt.toISOString(),
//         response.timeSpent || 0,
//         response.totalMarks || 0,
//         response.obtainedMarks || 0,
//         response.percentage ? response.percentage.toFixed(2) : 0,
//         response.resultStatus || "pending",
//       ];

//       form.fields.forEach((field) => {
//         const answer = response.answers.find(
//           (a) => a.fieldId.toString() === field._id.toString()
//         );

//         let answerValue = "";
//         if (answer && answer.value) {
//           if (Array.isArray(answer.value)) {
//             answerValue = answer.value.join(", ");
//           } else if (typeof answer.value === "object") {
//             answerValue = JSON.stringify(answer.value);
//           } else {
//             answerValue = String(answer.value);
//           }
//         }
//         row.push(answerValue);
//       });

//       form.fields.forEach((field) => {
//         const answer = response.answers.find(
//           (a) => a.fieldId.toString() === field._id.toString()
//         );
//         let fileUrls = "";
//         if (answer && answer.fileUrls && answer.fileUrls.length > 0) {
//           fileUrls = answer.fileUrls.join("; ");
//         }
//         row.push(fileUrls);
//       });

//       return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
//     });

//     const csvContent = [headers.join(","), ...rows].join("\n");

//     res.setHeader("Content-Type", "text/csv; charset=utf-8");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, "_")}_responses.csv"`
//     );
//     res.send(csvContent);
//   } catch (err) {
//     console.error("Error exporting CSV:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Update single answer evaluation (admin only)
// router.put("/:responseId/evaluate", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const { responseId } = req.params;
//     const { fieldId, marksAwarded, isCorrect } = req.body;

//     const response = await Response.findById(responseId);
//     if (!response) {
//       return res.status(404).json({ error: "Response not found" });
//     }

//     const answerIndex = response.answers.findIndex(
//       (a) => a.fieldId.toString() === fieldId
//     );

//     if (answerIndex === -1) {
//       return res.status(404).json({ error: "Answer not found" });
//     }

//     response.answers[answerIndex].marksAwarded = marksAwarded;
//     response.answers[answerIndex].isCorrect = isCorrect;

//     response.obtainedMarks = response.answers.reduce(
//       (sum, a) => sum + (a.marksAwarded || 0),
//       0
//     );
//     response.percentage = (response.obtainedMarks / response.totalMarks) * 100;
//     response.resultStatus = response.percentage >= 40 ? "pass" : "fail";

//     await response.save();

//     res.json({
//       success: true,
//       obtainedMarks: response.obtainedMarks,
//       percentage: response.percentage,
//       resultStatus: response.resultStatus,
//     });
//   } catch (err) {
//     console.error("Error evaluating response:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Batch update multiple answers (admin only)
// router.put("/:responseId/batch-evaluate", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const { responseId } = req.params;
//     const { updates } = req.body;

//     const response = await Response.findById(responseId);
//     if (!response) {
//       return res.status(404).json({ error: "Response not found" });
//     }

//     updates.forEach((update) => {
//       const answerIndex = response.answers.findIndex(
//         (a) => a.fieldId.toString() === update.fieldId
//       );
//       if (answerIndex !== -1) {
//         response.answers[answerIndex].marksAwarded = update.marksAwarded;
//         response.answers[answerIndex].isCorrect = update.isCorrect;
//       }
//     });

//     response.obtainedMarks = response.answers.reduce(
//       (sum, a) => sum + (a.marksAwarded || 0),
//       0
//     );
//     response.percentage = (response.obtainedMarks / response.totalMarks) * 100;
//     response.resultStatus = response.percentage >= 40 ? "pass" : "fail";

//     await response.save();

//     res.json({
//       success: true,
//       obtainedMarks: response.obtainedMarks,
//       percentage: response.percentage,
//       resultStatus: response.resultStatus,
//     });
//   } catch (err) {
//     console.error("Error batch evaluating response:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Delete a response (admin only)
// router.delete("/:responseId", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const { responseId } = req.params;

//     const response = await Response.findByIdAndDelete(responseId);

//     if (!response) {
//       return res.status(404).json({ error: "Response not found" });
//     }

//     res.json({
//       success: true,
//       message: "Response deleted successfully",
//     });
//   } catch (err) {
//     console.error("Error deleting response:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get form submission status for current user
// router.get("/:formId/status", auth, async (req, res) => {
//   try {
//     const { formId } = req.params;

//     const existingResponse = await Response.findOne({
//       formId,
//       submittedBy: req.user._id,
//     });

//     res.json({
//       hasSubmitted: !!existingResponse,
//       response: existingResponse
//         ? {
//             id: existingResponse._id,
//             submittedAt: existingResponse.submittedAt,
//             obtainedMarks: existingResponse.obtainedMarks,
//             totalMarks: existingResponse.totalMarks,
//             percentage: existingResponse.percentage,
//             resultStatus: existingResponse.resultStatus,
//           }
//         : null,
//     });
//   } catch (err) {
//     console.error("Error checking submission status:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const Response = require("../models/Response");
const Form = require("../models/Form");
const auth = require("../middleware/auth");

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ImgBB API Key
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "4e40960ee867d0115a4c0049f45f4572";

// Helper function to upload file to ImgBB
const uploadToImgBB = async (file) => {
  try {
    const formData = new FormData();
    formData.append("image", file.buffer.toString("base64"));
    formData.append("key", IMGBB_API_KEY);

    const response = await axios.post("https://api.imgbb.com/1/upload", formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

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
          (a) => a.fieldId === field._id.toString()
        );
        const hasFileUpload = uploadedFileUrls[field._id.toString()]?.length > 0;
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
        (f) => f._id.toString() === ans.fieldId.toString()
      );

      if (!field) continue;

      const correctAnswer = field.correctAnswer;
      const marks = field.marks || 1;
      const needsManualGrading = field.type === "image_text" || field.type === "file_upload";
      const fileUrls = uploadedFileUrls[ans.fieldId] || ans.fileUrls || [];

      console.log(`Field ${ans.fieldId} - Manual: ${needsManualGrading}, Files: ${fileUrls.length}`);

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
            String(ans.value || "").trim().toLowerCase() ===
            String(correctAnswer || "").trim().toLowerCase();
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
    const resultStatus = hasManualGrading ? "pending" : (percentage >= 40 ? "pass" : "fail");

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
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    });

    await response.save();
    await response.populate("submittedBy", "username email fullName rollNumber className phoneNumber");

    let message = "Response submitted successfully";
    if (hasManualGrading) {
      message = "Response submitted! Manual grading questions will be reviewed by the teacher.";
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
      .populate("submittedBy", "username email fullName rollNumber className phoneNumber")
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
      .populate("submittedBy", "username email fullName rollNumber className phoneNumber")
      .populate("formId", "title description className subject totalMarks duration fields");

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

// Batch update multiple answers (admin only)
router.put("/:responseId/batch-evaluate", auth, auth.adminOnly, async (req, res) => {
  try {
    const { responseId } = req.params;
    const { updates } = req.body;

    const response = await Response.findById(responseId);
    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    updates.forEach((update) => {
      const answerIndex = response.answers.findIndex(
        (a) => a.fieldId.toString() === update.fieldId
      );
      if (answerIndex !== -1) {
        response.answers[answerIndex].marksAwarded = update.marksAwarded;
        response.answers[answerIndex].isCorrect = update.isCorrect;
      }
    });

    response.obtainedMarks = response.answers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    response.percentage = (response.obtainedMarks / response.totalMarks) * 100;
    response.resultStatus = response.percentage >= 40 ? "pass" : "fail";

    await response.save();

    res.json({
      success: true,
      obtainedMarks: response.obtainedMarks,
      percentage: response.percentage,
      resultStatus: response.resultStatus,
    });
  } catch (err) {
    console.error("Error batch evaluating response:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;