const multer = require('multer');
const express = require('express');
const { userModel } = require('../database');
const updateRouter = express.Router();

// Function to update the user image and notify clients via socket
async function updateUserImage(res, userId, imageBuffer, imageMimeType, io) {
    try {
        // Update the user's image in the database
        const updatedUserImage = await userModel.updateOne(
            { _id: userId },
            { 
                image: {
                    data: imageBuffer,
                    contentType: imageMimeType
                }
            }
        );

        // Check if the update was successful
        if (updatedUserImage.matchedCount === 0) {
            // No user matched the provided userId
            const currentUser = await userModel.find({ _id: userId });
            if(io.emit && currentUser.loginDetails.length > 0){
                currentUser.loginDetails.forEach((loginData)=>{
                    io.to(loginData.socketId).emit("updateUser", currentUser);
                })
            }
            return res.status(404).json({ message: "User not found." });
        }

        // Successfully updated the user's image
        res.status(200).json({ success: true, message: "Image uploaded successfully." });
    } catch (error) {
        // Handle any errors that occurred during the update
        console.error(error); // Log the error for debugging
        res.status(500).json({ message: "An error occurred while updating the image.", error: error.message });
    }
}

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// Initialize multer with the defined storage and file size limit
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024  // Set file size limit to 15 MB
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files (e.g., jpg, png)
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    }
});

// Define the route to handle the single file upload
updateRouter.post("/addImage", upload.single('image'), (req, res) => {
    try {
        console.log(req,req.body);
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded or file is not an image." });
        } else {
            const imageBuffer = req.file.buffer; // Get the image data as a Buffer
            const imageMimeType = req.file.mimetype; // Get the MIME type of the image
            const userId = req.body.userId;

            // Pass 'io' to the updateUserImage function
            const io = req.app.get('io'); // Get the socket.io instance from the app
            updateUserImage(res, userId, imageBuffer, imageMimeType, io);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = updateRouter;
