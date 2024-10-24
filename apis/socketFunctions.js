const { userModel } = require("../database");

const addNewDeviceDetails = async (socket, userId) => {
    try {
        const updatedUserDetails = await userModel.updateOne(
            { _id: userId }, // Find the user by ID
            { $push: { loginDetails: { socketId: socket.id } } } // Push the new object to the loginDetails array
        );

        if (updatedUserDetails.matchedCount === 0) {
            // If no user found
            console.log(`No user found with ID: ${userId}`);
            socket.emit("serverError", "No user found with the provided ID");
        } else {
            // If the user is found and updated successfully
            // console.log(`Device successfully registered for user ID: ${userId}`);
            socket.emit("serverSuccess", "Device Successfully Registered");
        }
    } catch (error) {
        console.error("An error occurred while adding a new device:", error);
        socket.emit("serverError", error.message); // Emit error message to the client
    }
};

const removeDeviceDetails = async (socket) => {
    try {
        console.log("removing old device from the backend "+socket.id);
        const updatedUserDetails = await userModel.updateOne(
            { 'loginDetails.socketId': socket.id }, // Find the user with the matching socketId
            { $pull: { loginDetails: { socketId: socket.id } } } // Remove the object from the loginDetails array
        );

        if (updatedUserDetails.matchedCount === 0) {
            // If no user found with the given socketId
            console.log(`No user found with socket ID: ${socket.id}`);
            socket.emit("serverError", "No user found with the provided socket ID");
        } else {
            // If the login detail is removed successfully
            console.log(`Device successfully removed for socket ID: ${socket.id}`);
            socket.emit("serverSuccess", "Device Successfully Removed");
        }
    } catch (error) {
        console.error("An error occurred while removing the device:", error);
        socket.emit("serverError", error.message); // Emit error message to the client
    }
};


const returnChatsFound = async (socket, chatName, user) => {
    try {
        const chatsFound = await userModel.find({
            _id: { $ne: user._id },
            verified: true,
            name: { $regex: chatName, $options: "i" } // Case-insensitive search
        });
        socket.emit("chatsFound", chatsFound);
    } catch (error) {
        console.error("An error occurred while getting chats from search:", error);
        socket.emit("serverError", error.message);
    }
};


const addNewChat = async (io, socket, user, newChat, callback) => {
    try {
        console.log("Sending chat request in the backend");

        // Step 1: Check if the user has already sent a request to this recipient
        const existingRequest = await userModel.findOne({
            _id: user._id,
            "requestMade.receiverId": newChat._id
        });

        if (existingRequest) {
            // If a request already exists, prevent another request
            return callback({ success: false, message: "You have already sent a request to this user." });
        }

        // Step 2: Check if the recipient has already received a request from this sender
        const existingReceiverRequest = await userModel.findOne({
            _id: newChat._id,
            "requestReceived.senderId": user._id
        });

        if (existingReceiverRequest) {
            return callback({ success: false, message: "This user has already received a request from you." });
        }

        // Step 3: Add data to the user REQUEST SENT
        const updateUserRequestSent = await userModel.updateOne(
            { _id: user._id },
            { $push: { requestMade: { receiverId: newChat._id, name: newChat.name } } }
        );

        if (updateUserRequestSent.matchedCount === 0) {
            callback({ success: false, message: "Failed to send request" });
        } else {
            // Step 4: Update data to the receiver's received request
            const updateReceiverReceivedRequest = await userModel.updateOne(
                { _id: newChat._id },
                { $push: { requestReceived: { senderId: user._id, name: user.name } } }
            );

            if (updateReceiverReceivedRequest.matchedCount === 0) {
                callback({ success: false, message: "Failed to send request" });
            } else {
                // Send a socket event that will update the user state on all devices
                callback({ success: true, message: "Chat Request sent successfully" });

                // Step 5: Fetch the latest documents for both the sender and the recipient
                const userDocument = await userModel.findOne({ _id: user._id });
                const newChatDocument = await userModel.findOne({ _id: newChat._id });

                // Step 6: Update the sender's devices
                userDocument.loginDetails.forEach((loginData) => {
                    console.log("Updating the user info on their devices");
                    io.to(loginData.socketId).emit("updateUser", userDocument);
                });

                // Step 7: Update the recipient's devices with their updated data
                newChatDocument.loginDetails.forEach((loginData) => {
                    console.log("Updating the recipient (newChat) info on their devices");
                    io.to(loginData.socketId).emit("updateUser", newChatDocument);
                });
            }
        }
    } catch (error) {
        console.log("An error occurred while adding new chat: " + error.message);
        callback({ success: false, message: `An error occurred while sending chat request: ${error.message}` });
    }
};


async function cancelRequest(io, socket, user, chatToCancelId, callback) {
    // Remove the request from the user who made it
    const updatedUser = await userModel.updateOne(
      { _id: user._id },
      { $pull: { requestMade: { receiverId: chatToCancelId } } }
    );
    console.log(updatedUser);
  
    if (updatedUser.matchedCount == 0) {
      callback({ success: false, message: "Failed to Delete Request" });
    } else {
      // Update the requestReceived field of the invited user
      const updatedInvitedUser = await userModel.updateOne(
        { _id: chatToCancelId },
        { $pull: { requestReceived: { senderId: user._id } } }
      );
      console.log(updatedUser, updatedInvitedUser);
  
      if (updatedInvitedUser.matchedCount == 0) {
        callback({ message: "Failed to delete request for the recipient", success: false });
      } else {
        // If everything was successful
        callback({ message: "Request deleted successfully", success: true });
  
        // Fetch the latest states of both users
        const currentUser = await userModel.findOne({ _id: user._id });
        const invitedUser = await userModel.findOne({ _id: chatToCancelId });
  
        // Notify all devices of both users
        currentUser.loginDetails.forEach((loginData) => {
          io.to(loginData.socketId).emit("updateUser", currentUser);
        });
  
        invitedUser.loginDetails.forEach((loginData) => {
          io.to(loginData.socketId).emit("updateUser", invitedUser);
        });
      }
    }
  }
  




module.exports = {
    addNewDeviceDetails,
    removeDeviceDetails,
    returnChatsFound,
    addNewChat,
    cancelRequest
};
