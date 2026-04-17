const express = require("express");
const Response = require("../models/Response");
const Form = require("../models/Form");
const auth = require("../middleware/auth");

const router = express.Router();

// Submit a response
// router.post("/", async (req, res) => {
//   try {
//     const { formId, answers } = req.body;

//     // Verify form exists and is published
//     const form = await Form.findById(formId);
//     if (!form) {
//       return res.status(404).json({ error: "Form not found" });
//     }
//     if (!form.isPublished) {
//       return res.status(400).json({ error: "Form is not published" });
//     }

//     // Validate required fields
//     const missingFields = form.fields
//       .filter((field) => field.required)
//       .filter(
//         (field) =>
//           !answers.some(
//             (answer) =>
//               answer.fieldId.toString() === field._id.toString() &&
//               answer.value !== undefined &&
//               answer.value !== "",
//           ),
//       );

//     if (missingFields.length > 0) {
//       return res.status(400).json({
//         error: "Required fields are missing",
//         missingFields: missingFields.map((f) => f.label),
//       });
//     }

//     const response = new Response({
//       formId,
//       answers,
//       submittedBy: req.user ? req.user._id : undefined,
//       ipAddress: req.ip,
//       userAgent: req.get("User-Agent"),
//     });

//     await response.save();
//     res.status(201).json({ message: "Response submitted successfully" });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });
router.post("/", async (req, res) => {
  try {
    const { formId, answers } = req.body;

    // ✅ Get form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    if (!form.isPublished) {
      return res.status(400).json({ error: "Form is not published" });
    }

    // ✅ Prevent multiple submissions
    if (req.user) {
      const existing = await Response.findOne({
        formId,
        submittedBy: req.user._id,
      });

      if (existing) {
        return res.status(400).json({
          error: "You have already submitted this exam",
        });
      }
    }

    // ✅ Validate required fields
    const missingFields = form.fields
      .filter((field) => field.required)
      .filter(
        (field) =>
          !answers.some(
            (answer) =>
              answer.fieldId.toString() === field._id.toString() &&
              answer.value !== undefined &&
              answer.value !== "",
          ),
      );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Required fields are missing",
        missingFields: missingFields.map((f) => f.label),
      });
    }

    // ✅ AUTO CHECK LOGIC START
    let totalMarks = 0;
    let obtainedMarks = 0;

    const evaluatedAnswers = answers.map((ans) => {
      const field = form.fields.find(
        (f) => f._id.toString() === ans.fieldId.toString(),
      );

      if (!field) return null;

      const correctAnswer = field.correctAnswer;
      const marks = field.marks || 1;

      totalMarks += marks;

      let isCorrect = false;
      let marksAwarded = 0;

      // ✅ Type-based checking
      switch (field.type) {
        case "checkbox":
          isCorrect =
            Array.isArray(ans.value) &&
            Array.isArray(correctAnswer) &&
            ans.value.sort().toString() === correctAnswer.sort().toString();
          break;

        case "number":
          isCorrect = Number(ans.value) === Number(correctAnswer);
          break;

        case "checkbox_grid":
        case "multiple_choice_grid":
          isCorrect =
            JSON.stringify(ans.value) === JSON.stringify(correctAnswer);
          break;

        default:
          isCorrect =
            String(ans.value || "").trim() ===
            String(correctAnswer || "").trim();
      }

      // ✅ Assign marks
      if (isCorrect) {
        marksAwarded = marks;
        obtainedMarks += marks;
      }

      return {
        fieldId: ans.fieldId,
        fieldLabel: ans.fieldLabel,
        value: ans.value,

        isCorrect,
        correctAnswer, 
        marksAwarded,
      };
    });

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

    const resultStatus = percentage >= 40 ? "pass" : "fail";

    // ✅ SAVE RESPONSE
    const response = new Response({
      formId,
      className: form.className,
      subject: form.subject,

      answers: evaluatedAnswers.filter(Boolean),

      submittedBy: req.user ? req.user._id : undefined,

      totalMarks,
      obtainedMarks,
      percentage,
      resultStatus,

      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    await response.save();

    // ✅ RETURN RESULT
    res.status(201).json({
      message: "Response submitted & evaluated successfully",
      totalMarks,
      obtainedMarks,
      percentage,
      resultStatus,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get responses for a specific form (admin only)
router.get("/:formId", auth, auth.adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const responses = await Response.find({ formId: req.params.formId })
      .populate("submittedBy", "username email")
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Response.countDocuments({ formId: req.params.formId });

    res.json({
      responses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export responses to CSV
router.get("/:formId/export", auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findById(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    const responses = await Response.find({ formId: req.params.formId })
      .populate("submittedBy", "username email")
      .sort({ submittedAt: -1 });

    // Create CSV headers
    const headers = [
      "Submitted At",
      "Submitted By",
      ...form.fields.map((f) => f.label),
    ];

    // Create CSV rows
    const rows = responses.map((response) => {
      const row = [
        response.submittedAt.toISOString(),
        response.submittedBy ? response.submittedBy.username : "Anonymous",
      ];

      form.fields.forEach((field) => {
        const answer = response.answers.find(
          (a) => a.fieldId.toString() === field._id.toString(),
        );
        row.push(answer ? answer.value || "" : "");
      });

      return row;
    });

    // Convert to CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${form.title}_responses.csv"`,
    );
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
