import React, { useState, useCallback, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Printer, X, Check } from 'lucide-react';

type PhotoBoothState = 'setup' | 'ready' | 'countdown' | 'preview';

const CAPTURE_WIDTH = 1920;  // Increased for better quality
const CAPTURE_HEIGHT = 2400; // Increased for better quality
const WEBSOCKET_URL = 'ws://localhost:8000/ws';

function App() {
  const [state, setState] = useState<PhotoBoothState>('setup');
  const [countdown, setCountdown] = useState(3);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prints, setPrints] = useState(1);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isPalmDetected, setIsPalmDetected] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting devices:', error);
    }
  }, []);

  useEffect(() => {
    getDevices();
  }, [getDevices]);

  // WebSocket connection for palm detection
  useEffect(() => {
    if (state === 'ready') {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (event.data === 'start' && !isPalmDetected) {
          setIsPalmDetected(true);
          startCountdown();
        }
      };

      // Send frames to backend for palm detection
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const imageSrc = webcamRef.current?.getScreenshot();
          if (imageSrc) {
            ws.send(imageSrc);
          }
        }
      }, 200); // Check for palm every 200ms

      return () => {
        clearInterval(interval);
        ws.close();
      };
    }
  }, [state]);

  const startCountdown = useCallback(() => {
    setState('countdown');
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          const imageSrc = webcamRef.current?.getScreenshot({
            width: CAPTURE_WIDTH,
            height: CAPTURE_HEIGHT
          });
          if (imageSrc) {
            setCapturedImage(imageSrc);
            setState('preview');
            setIsPalmDetected(false);
          }
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handlePrint = useCallback(() => {
    if (!capturedImage) return;

    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    document.body.appendChild(printFrame);
    
    const printDoc = printFrame.contentWindow?.document;
    if (!printDoc) return;

    // Enhanced print settings with forced color
    printDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page {
              size: 4in 6in;
              margin: 0;
              color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            body {
              margin: 0;
              padding: 0;
              width: 4in;
              height: 6in;
              display: flex;
              flex-direction: column;
              align-items: center;
              background: white;
            }
            .print-container {
              width: 3.5in;
              height: 4.5in;
              margin: 0.25in;
              border: 0.125in solid white;
              box-shadow: 0 0 0 0.125in white;
              overflow: hidden;
              background: white;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
            .bottom-space {
              width: 4in;
              height: 1in;
              background: white;
            }
          </style>
        </head>
        <body>
          ${Array(prints).fill(`
            <div class="print-container">
              <img src="${capturedImage}" />
            </div>
            <div class="bottom-space"></div>
          `).join('')}
        </body>
      </html>
    `);
    printDoc.close();

    // Print with color settings
    const printOptions = {
      colorMode: 'color',
      printerColorMode: 'color'
    };
    
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(printFrame);
      setState('ready');
      setCapturedImage(null);
    }, 500);
  }, [capturedImage, prints]);

  const videoConstraints = {
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    deviceId: selectedCamera,
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {state === 'setup' && (
            <div className="bg-gray-800 rounded-lg p-8">
              <h2 className="text-xl font-semibold mb-4">Select Camera</h2>
              <select
                className="w-full p-2 rounded bg-gray-700 mb-4"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
              <button
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold"
                onClick={() => setState('ready')}
              >
                Start Photo Booth
              </button>
            </div>
          )}

          {(state === 'ready' || state === 'countdown') && (
            <div className="relative">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-lg">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
              </div>
              {state === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-9xl font-bold text-white drop-shadow-lg">
                    {countdown}
                  </span>
                </div>
              )}
              {state === 'ready' && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <div className="text-center text-xl font-semibold">
                    Show your palm to camera to start
                  </div>
                </div>
              )}
            </div>
          )}

          {state === 'preview' && capturedImage && (
            <div className="bg-gray-800 rounded-lg p-8">
              <div className="relative">
                <div className="aspect-[4/5] w-full overflow-hidden p-8 bg-white rounded-lg">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover border-[24px] border-white shadow-[0_0_0_24px_white]"
                  />
                </div>
                
                {/* Print selection UI integrated into preview */}
                <div className="mt-6 bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold">Number of Prints:</span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setPrints(p => Math.max(1, p - 1))}
                        className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold text-xl"
                      >
                        -
                      </button>
                      <span className="text-2xl font-bold">{prints}</span>
                      <button
                        onClick={() => setPrints(p => p + 1)}
                        className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold text-xl"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={handlePrint}
                      className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      Print {prints} {prints === 1 ? 'Copy' : 'Copies'}
                    </button>
                    <button
                      onClick={() => {
                        setState('ready');
                        setCapturedImage(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Retake
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;