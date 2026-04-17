// const express = require("express");
// const Form = require("../models/Form");
// const Response = require("../models/Response");
// const auth = require("../middleware/auth");

// const router = express.Router();

// // Create a new form (admin only)
// router.post("/", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const { title, className, subject } = req.body;

//     if (!className || !subject) {
//       return res.status(400).json({
//         error: "Class and Subject are required",
//       });
//     }

//     const form = new Form({
//       ...req.body,
//       createdBy: req.user._id,
//     });

//     await form.save();
//     await form.populate("createdBy", "username email");

//     res.status(201).json(form);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// router.get("/:id/details", auth, async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.id).populate(
//       "createdBy",
//       "username",
//     ); // No .select(), so it gets everything
//     if (!form) return res.status(404).json({ error: "Form not found" });
//     res.json(form);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get all forms (summary)
// router.get("/", auth, async (req, res) => {
//   try {
//     const { className, subject } = req.query;

//     const filter = {};

//     if (className) filter.className = className;
//     if (subject) filter.subject = subject;

//     const forms = await Form.find(filter)
//       .populate("createdBy", "username")
//       .sort({ createdAt: -1 });

//     res.json(forms);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get("/:id/start", auth, async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.id);

//     if (!form) return res.status(404).json({ error: "Form not found" });

//     let fields = [...form.fields];

//     // ✅ Shuffle Questions
//     if (form.shuffleQuestions) {
//       fields.sort(() => Math.random() - 0.5);
//     }

//     // ✅ Shuffle Options (MCQ)
//     if (form.shuffleOptions) {
//       fields = fields.map((q) => {
//         if (q.options) {
//           q.options.sort(() => Math.random() - 0.5);
//         }
//         return q;
//       });
//     }

//     res.json({ ...form.toObject(), fields });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// router.get("/meta/subjects", async (req, res) => {
//   try {
//     const { className } = req.query;

//     const subjects = await Form.distinct("subject", {
//       ...(className && { className }),
//     });

//     res.json(subjects);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// // Get a single form by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.id).populate(
//       "createdBy",
//       "username",
//     );
//     if (!form) return res.status(404).json({ error: "Form not found" });
//     res.json(form);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Update a form (admin only)
// router.put("/:id", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const form = await Form.findByIdAndUpdate(
//       req.params.id,
//       { ...req.body, updatedAt: new Date() },
//       { new: true, runValidators: true },
//     ).populate("createdBy", "username email");

//     if (!form) return res.status(404).json({ error: "Form not found" });
//     res.json(form);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// // Delete a form (admin only)
// router.delete("/:id", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const form = await Form.findByIdAndDelete(req.params.id);
//     if (!form) return res.status(404).json({ error: "Form not found" });

//     // Also delete all responses for this form
//     await Response.deleteMany({ formId: req.params.id });

//     res.json({ message: "Form deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Get form analytics
// router.get("/:id/analytics", auth, auth.adminOnly, async (req, res) => {
//   try {
//     const responses = await Response.find({ formId: req.params.id });
//     const totalResponses = responses.length;

//     // Group responses by date
//     const responsesByDate = responses.reduce((acc, response) => {
//       const date = response.submittedAt.toISOString().split("T")[0];
//       acc[date] = (acc[date] || 0) + 1;
//       return acc;
//     }, {});

//     // Calculate field statistics
//     const fieldStats = {};
//     if (responses.length > 0) {
//       const form = await Form.findById(req.params.id);
//       form.fields.forEach((field) => {
//         const fieldResponses = responses
//           .map((r) =>
//             r.answers.find(
//               (a) => a.fieldId.toString() === field._id.toString(),
//             ),
//           )
//           .filter(Boolean);

//         fieldStats[field._id] = {
//           label: field.label,
//           type: field.type,
//           responseCount: fieldResponses.length,
//           // Add more statistics based on field type
//         };
//       });
//     }

//     res.json({
//       totalResponses,
//       responsesByDate,
//       fieldStats,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;

const express = require("express");
const Form = require("../models/Form");
const Response = require("../models/Response");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * ✅ CREATE EXAM (ADMIN)
 */
router.post("/", auth, auth.adminOnly, async (req, res) => {
  try {
    const { title, className, subject, duration } = req.body;

    if (!title || !className || !subject) {
      return res.status(400).json({
        error: "Title, Class and Subject are required",
      });
    }

    const form = new Form({
      ...req.body,
      duration: duration || 30, // default 30 min
      createdBy: req.user._id,
    });

    await form.save();
    await form.populate("createdBy", "username email");

    res.status(201).json(form);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * ✅ GET ALL EXAMS (FILTER BY CLASS + SUBJECT)
 */
router.get("/", auth, async (req, res) => {
  try {
    const { className, subject } = req.query;

    const filter = {};
    if (className) filter.className = className;
    if (subject) filter.subject = subject;

    const forms = await Form.find(filter)
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });

    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ GET SUBJECT LIST
 */
router.get("/meta/subjects", async (req, res) => {
  try {
    const { className } = req.query;

    const subjects = await Form.distinct("subject", {
      ...(className && { className }),
    });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ START EXAM (IMPORTANT 🔥)
 * - Shuffle questions
 * - Shuffle options
 * - Prevent multiple attempts
 * - Set timer
 */
router.get("/:id/start", auth, async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) return res.status(404).json({ error: "Exam not found" });

    if (!form.isPublished) {
      return res.status(400).json({ error: "Exam not published" });
    }

    // ❌ Prevent multiple attempts
    const existingAttempt = await Response.findOne({
      formId: form._id,
      submittedBy: req.user._id,
    });

    if (existingAttempt) {
      return res.status(400).json({
        error: "You have already attempted this exam",
      });
    }

    let fields = [...form.fields];

    // ✅ Shuffle questions
    if (form.shuffleQuestions) {
      fields.sort(() => Math.random() - 0.5);
    }

    // ✅ Shuffle options
    if (form.shuffleOptions) {
      fields = fields.map((q) => {
        if (q.options && q.options.length > 0) {
          q.options.sort(() => Math.random() - 0.5);
        }
        return q;
      });
    }

    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + form.duration * 60 * 1000
    );

    res.json({
      ...form.toObject(),
      fields,
      startTime,
      endTime,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ GET SINGLE EXAM
 */
router.get("/:id", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id).populate(
      "createdBy",
      "username"
    );

    if (!form) return res.status(404).json({ error: "Exam not found" });

    res.json(form);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ UPDATE EXAM (ADMIN)
 */
router.put("/:id", auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate("createdBy", "username email");

    if (!form) return res.status(404).json({ error: "Exam not found" });

    res.json(form);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * ✅ DELETE EXAM
 */
router.delete("/:id", auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findByIdAndDelete(req.params.id);

    if (!form) return res.status(404).json({ error: "Exam not found" });

    await Response.deleteMany({ formId: req.params.id });

    res.json({ message: "Exam deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ ANALYTICS (UPGRADED)
 */
router.get("/:id/analytics", auth, auth.adminOnly, async (req, res) => {
  try {
    const responses = await Response.find({ formId: req.params.id });

    const totalResponses = responses.length;

    const averageScore =
      responses.reduce((acc, r) => acc + (r.percentage || 0), 0) /
      (responses.length || 1);

    const passCount = responses.filter(
      (r) => r.resultStatus === "pass"
    ).length;

    const failCount = responses.filter(
      (r) => r.resultStatus === "fail"
    ).length;

    res.json({
      totalResponses,
      averageScore: Math.round(averageScore),
      passCount,
      failCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;