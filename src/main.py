from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import cv2
import mediapipe as mp
import numpy as np
import base64
from PIL import Image
import io

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

def detect_palm(image):
    # Convert the image to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Process the image and detect hands
    results = hands.process(image_rgb)
    
    if results.multi_hand_landmarks:
        # Get the first detected hand
        hand_landmarks = results.multi_hand_landmarks[0]
        
        # Check if palm is facing the camera
        # We'll use the thumb, index, and pinky positions to determine orientation
        thumb = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
        index = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
        pinky = hand_landmarks.landmark[mp_hands.HandLandmark.PINKY_TIP]
        wrist = hand_landmarks.landmark[mp_hands.HandLandmark.WRIST]
        
        # Calculate if fingers are extended and palm is facing camera
        fingers_extended = (
            thumb.y < wrist.y and
            index.y < wrist.y and
            pinky.y < wrist.y
        )
        
        return fingers_extended
    
    return False

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Receive base64 image from client
            data = await websocket.receive_text()
            
            try:
                # Decode base64 image
                img_data = base64.b64decode(data.split(',')[1])
                img = Image.open(io.BytesIO(img_data))
                
                # Convert PIL Image to OpenCV format
                opencv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                
                # Detect palm
                palm_detected = detect_palm(opencv_img)
                
                # Send result back to client
                await websocket.send_text("start" if palm_detected else "wait")
                
            except Exception as e:
                print(f"Error processing image: {e}")
                await websocket.send_text("error")
                
    except Exception as e:
        print(f"WebSocket error: {e}")