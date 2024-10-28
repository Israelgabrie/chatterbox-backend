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
            const updatedUserActiveStatus = await userModel.updateOne(
                { _id: userId }, // Find the user by ID
                {active:true } // set the user status of active to true
            );
            socket.emit("serverSuccess", "Device Successfully Registered");
        }
    } catch (error) {
        console.error("An error occurred while adding a new device:", error);
        socket.emit("serverError", error.message); // Emit error message to the client
    }
};

const removeDeviceDetails = async (socket) => {
    try {
        // Find the current user based on the socket ID
        const currentUserState = await userModel.findOne({ 'loginDetails.socketId': socket.id });

        if (!currentUserState) {
            console.log(`No user found with socket ID: ${socket.id}`);
            socket.emit("serverError", "No user found with the provided socket ID");
            return;
        }

        // Remove the device with the matching socket ID from loginDetails
        const updatedUserDetails = await userModel.updateOne(
            { 'loginDetails.socketId': socket.id },
            { $pull: { loginDetails: { socketId: socket.id } } }
        );

        if (updatedUserDetails.matchedCount === 0) {
            console.log(`No user found with socket ID: ${socket.id}`);
            socket.emit("serverError", "No user found with the provided socket ID");
            return;
        }

        // Check if user has any other connected devices
        const userAfterRemoval = await userModel.findOne({ _id: currentUserState._id });

        if (!userAfterRemoval.loginDetails || userAfterRemoval.loginDetails.length === 0) {
            // If no devices are connected, set active to false
            await userModel.updateOne(
                { _id: currentUserState._id },
                { active: false }
            );
            console.log(`User ${currentUserState.name} has no devices connected`);
        }

        // Successfully removed the device
        console.log(`Device successfully removed for socket ID: ${socket.id}`);
        socket.emit("serverSuccess", "Device Successfully Removed");

    } catch (error) {
        console.error("An error occurred while removing the device:", error);
        socket.emit("serverError", error.message);
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

                // update both their notifications 
                const updateFriendNotifications = await userModel.updateOne({_id:newChat._id},
                    {$push : {notifications : {title:"Friend Request",text:`${user.name} Sent You a friend Request`}}}
                )

                // Step 5: Fetch the full documents for both the sender and the recipient
                const userDocument = await userModel.findOne({ _id: user._id });
                const newChatDocument = await userModel.findOne({ _id: newChat._id });

                // Log the documents to ensure they include all necessary fields
                console.log("User Document:", userDocument);
                console.log("New Chat Document:", newChatDocument);

                // Step 6: Update the sender's devices
                userDocument.loginDetails.forEach((loginData) => {
                    console.log("Updating the user info on their devices");
                    io.to(loginData.socketId).emit("updateUser", userDocument);
                });

                // Step 7: Update the recipient's devices with their updated data
                newChatDocument.loginDetails.forEach((loginData) => {
                    console.log("Updating the recipient (newChat) info on their devices");
                    io.to(loginData.socketId).emit("updateUser", newChatDocument);
                    io.to(loginData.socketId).emit("newNotification", `Friend Request Sent From ${userDocument.name}`);
                });
            }
        }
    } catch (error) {
        console.log("An error occurred while adding new chat: " + error.message);
        callback({ success: false, message: `An error occurred while sending chat request: ${error.message}` });
    }
};


async function cancelRequest(io, socket, user, chatToCancelId, callback) {
    try{
    // Remove the request from the user who made it
    const updatedUser = await userModel.updateOne(
      { _id: user._id },
      { $pull: { requestMade: { receiverId: chatToCancelId } } }
    );
  
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

        const currentUser = await userModel.findOne({_id:user._id});
        const invitedUser = await userModel.findOne({_id:chatToCancelId})
  
        // Notify all devices of both users
        currentUser.loginDetails.forEach((loginData) => {
          io.to(loginData.socketId).emit("updateUser", currentUser);
        });
  
        invitedUser.loginDetails.forEach((loginData) => {
          io.to(loginData.socketId).emit("updateUser", invitedUser);
        });
      }
    }
    }catch(error){
        callback({ message: error.message, success: false });
    }
  }

  async function acceptRequest(io, socket, user, idToBeAccepted, callback) {
    try {
        // Remove idToBeAccepted user from MY requestReceived list 
        const removeRequestReceivedUser = await userModel.updateOne(
            { _id: user._id },
            { $pull: { requestReceived: { senderId: idToBeAccepted } } }
        );

        // Remove MY id from the other user's requestMade list
        const removeReceiverSentRequest = await userModel.updateOne(
            { _id: idToBeAccepted },
            { $pull: { requestMade: { receiverId: user._id } } }
        );

        // Fetch the idToBeAccepted user details
        const getIdToBeAcceptedUser = await userModel.findById(idToBeAccepted);

        // Add the accepted user to MY chat list
        const addChatToUser = await userModel.updateOne(
            { _id: user._id },
            {
                $push: {
                    chats: {
                        name: getIdToBeAcceptedUser.name,
                        isGroup: false,
                        groupAdminId: "",
                        groupId: "",
                        participants: [],
                        friendId: getIdToBeAcceptedUser._id, // Corrected here
                        blocked: false,
                        messages: []
                    }
                }
            }
        );

        // Add MY details to the accepted user's chat list
        const addMyObjectToFriendChat = await userModel.updateOne(
            { _id: idToBeAccepted },
            {
                $push: {
                    chats: {
                        name: user.name,
                        isGroup: false,
                        groupAdminId: "",
                        groupId: "",
                        participants: [],
                        friendId: user._id,
                        blocked: false,
                        messages: []
                    }
                }
            }
        );

        // Check if all operations were successful
        if (removeRequestReceivedUser.matchedCount === 0 || removeReceiverSentRequest.matchedCount === 0 || addChatToUser.matchedCount === 0 || addMyObjectToFriendChat.matchedCount === 0) {
            callback({ success: false, message: "Failed to accept friend request" });
        } else {
            callback({ success: true, message: "Friend request accepted successfully" });

             // update both their notifications 
             const updatedReceiverNotification = await userModel.updateOne({_id:idToBeAccepted},
                {$push : {notifications : {title:"Request Accepted",text:`${user.name} Accepted Your Freind Request`}}}
            )

            const updatedFriend = await userModel.findById(idToBeAccepted);
            const updatedUser = await userModel.findById(user._id);

            // Emit updatedUser and notifications to both parties
            updatedUser.loginDetails.forEach((loginData) => {
                io.to(loginData.socketId).emit("updateUser", updatedUser);
            });

            updatedFriend.loginDetails.forEach((loginData) => {
                io.to(loginData.socketId).emit("updateUser", updatedFriend);
                io.to(loginData.socketId).emit("newNotification", `${updatedUser.name} accepted your friend request`);
            });
        }
    } catch (error) {
        console.log("Error while accepting friend request:", error);
        callback({ success: false, message: error.message });
    }
}

async function declineRequest(io, socket, user, idToBeRejected, callback) {
    try {
        console.log("decline user friend request")
        // Remove idToBeRejected user from MY requestReceived list
        const removeRequestReceivedUser = await userModel.updateOne(
            { _id: user._id },
            { $pull: { requestReceived: { senderId: idToBeRejected } } }
        );

        // Remove MY id from the other user's requestMade list
        const removeReceiverSentRequest = await userModel.updateOne(
            { _id: idToBeRejected },
            { $pull: { requestMade: { receiverId: user._id } } }
        );

        // Check if both operations were successful
        if (
            removeRequestReceivedUser.matchedCount === 0 ||
            removeReceiverSentRequest.matchedCount === 0
        ) {
            // If not, send a failure response
            callback({ success: false, message: "Failed to decline friend request" });
        } else {
            // If successful, send a success response
            callback({ success: true, message: "Friend request declined successfully" });

            // Optionally, you can send a notification to the user whose request was declined
            const updatedReceiverNotification = await userModel.updateOne(
                { _id: idToBeRejected },
                {
                    $push: {
                        notifications: {
                            title: "Request Declined",
                            text: `${user.name} declined your friend request`
                        }
                    }
                }
            );

            // Fetch updated user details for the one who sent the request
            const updatedFriend = await userModel.findById(idToBeRejected);

            // Emit updates to the user who sent the friend request
            if (updatedFriend) {
                updatedFriend.loginDetails.forEach((loginData) => {
                    io.to(loginData.socketId).emit("updateUser", updatedFriend);
                    io.to(loginData.socketId).emit("newNotification", `${user.name} declined your friend request`);
                });
            }
        }
    } catch (error) {
        // Log any errors and send an error response
        console.log("Error while declining friend request:", error);
        callback({ success: false, message: error.message });
    }
}




async function addChatMessage(io, socket, textMessage, user, idOfReceiver, callback) {
    try {
        // Filter for the user's chat with the receiver
        const userChatFilter = { _id: user._id, "chats.friendId": idOfReceiver };
        const receiverChatFilter = { _id: idOfReceiver, "chats.friendId": user._id };

        // Push the message into the user's chat messages
        const updatedUserMessage = await userModel.updateOne(
            userChatFilter,
            { 
                $push: { 
                    "chats.$.messages": { 
                        message: textMessage, 
                        senderId: user._id, 
                        receiverId: idOfReceiver, 
                        type: 'text' 
                    }
                }
            }
        );

        // Push the message into the receiver's chat messages
        const updatedReceiverMessage = await userModel.updateOne(
            receiverChatFilter,
            { 
                $push: { 
                    "chats.$.messages": { 
                        message: textMessage, 
                        senderId: user._id, // Sender remains the user here
                        receiverId: idOfReceiver, 
                        type: 'text' 
                    }
                }
            }
        );

        // Check if the messages were successfully updated for both users
        if (updatedUserMessage.matchedCount === 0 || updatedReceiverMessage.matchedCount === 0) {
            callback({ success: false, message: "Failed to send message" });
        } else {
            callback({ success: true, message: "Message sent successfully" });

            // Find the updated documents to emit socket events
            const userDocument = await userModel.findOne({ _id: user._id });
            const receiverDocument = await userModel.findOne({ _id: idOfReceiver });

            // Emit updated user and notifications to both users
            userDocument.loginDetails.forEach((loginData) => {
                io.to(loginData.socketId).emit("updateUser", userDocument);
            });

            receiverDocument.loginDetails.forEach((loginData) => {
                io.to(loginData.socketId).emit("updateUser", receiverDocument);
                io.to(loginData.socketId).emit("newNotification", `${userDocument.name} sent you a message`);
            });
        }
    } catch (error) {
        callback({ success: false, message: error.message });
    }
}
  

async function addDisplayImage(io,socket,userId,fileBuffer,fileType,callback){
    try{
        console.log(userId,"id of user")
        const updateUserImage = await userModel.updateOne({_id:userId},
            {image : {buffer : fileBuffer , contentType : fileType}}
        );
        if(updateUserImage.matchedCount == 0){
            callback({success:false,message:"unable to update user display image"})
        }else{
            callback({success:true,message:"display image updated successfully"})
            const updatedUser = await userModel.findOne({_id:userId});
            console.log(updatedUser.image.buffer)
            updatedUser.loginDetails.forEach((loginData)=>{
                io.to(loginData.socketId).emit("updateUser",updatedUser)
            })
        }
    }catch(error){
        console.log(`error updating user display image ${error.message}`)
        callback({success:false,message:error.message})
    }
}



module.exports = {
    addDisplayImage,
    addNewDeviceDetails,
    removeDeviceDetails,
    returnChatsFound,
    addNewChat,
    cancelRequest,
    acceptRequest,
    addChatMessage,
    declineRequest,
};
