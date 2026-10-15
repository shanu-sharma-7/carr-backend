
import ContactMessage from "../models/ContactMessage.js";

// Customer ki enquiry save karna
export const createContactMessage = async (req, res) => {
  try {
    const { name, email, phone, carName, message } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    const savedMessage = await ContactMessage.create({
      name,
      email,
      phone,
      carName,
      message,
    });

    return res.status(201).json({
      success: true,
      message: "Contact enquiry saved successfully.",
      data: savedMessage,
    });
  } catch (error) {
    console.error("CREATE CONTACT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save contact enquiry.",
    });
  }
};

// Admin ke liye contact messages list
export const getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error("GET CONTACT MESSAGES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch contact messages.",
    });
  }
};

// Message ka status update karna
export const updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["new", "read", "contacted"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact status.",
      });
    }

    const updatedMessage = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    console.error("UPDATE CONTACT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update contact status.",
    });
  }
};

// Message delete karna
export const deleteContactMessage = async (req, res) => {
  try {
    const deletedMessage = await ContactMessage.findByIdAndDelete(
      req.params.id
    );

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact message deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE CONTACT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete contact message.",
    });
  }
};
