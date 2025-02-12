import React, { useState, useCallback, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera, Printer, X, Check, Hand } from 'lucide-react';

type PhotoBoothState = 'setup' | 'ready' | 'countdown' | 'preview' | 'prints';

// 4x5 image dimensions (maintaining aspect ratio for portrait orientation)
const CAPTURE_WIDTH = 1200;
const CAPTURE_HEIGHT = 1500;

function App() {
  const [state, setState] = useState<PhotoBoothState>('setup');
  const [countdown, setCountdown] = useState(3);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prints, setPrints] = useState(1);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const webcamRef = useRef<Webcam>(null);
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

  React.useEffect(() => {
    getDevices();
  }, [getDevices]);

  const applyBlackAndWhiteFilter = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = CAPTURE_WIDTH;
        canvas.height = CAPTURE_HEIGHT;
        const ctx = canvas.getContext('2d')!;
        
        // Draw image and apply grayscale filter
        ctx.drawImage(img, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;     // Red
          data[i + 1] = avg; // Green
          data[i + 2] = avg; // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      img.src = imageSrc;
    });
  };

  const startCountdown = useCallback(() => {
    setState('countdown');
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          const imageSrc = webcamRef.current?.getScreenshot();
          if (imageSrc) {
            applyBlackAndWhiteFilter(imageSrc).then(filteredImage => {
              setCapturedImage(filteredImage);
              setState('preview');
            });
          }
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handlePrint = useCallback(() => {
    if (!capturedImage) return;

    // Create a temporary iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    document.body.appendChild(printFrame);
    
    const printDoc = printFrame.contentWindow?.document;
    if (!printDoc) return;

    // Set up print document with proper styling for 4x6 portrait with 4x5 image area
    printDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page {
              size: 4in 6in;
              margin: 0;
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
          <div class="print-container">
            <img src="${capturedImage}" />
          </div>
          <div class="bottom-space"></div>
        </body>
      </html>
    `);
    printDoc.close();

    // Print the frame
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(printFrame);
      setState('ready');
      setCapturedImage(null);
    }, 500);
  }, [capturedImage]);

  const videoConstraints = {
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    deviceId: selectedCamera,
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Camera className="w-8 h-8" />
              College Fest Photo Booth
            </h1>
          </div>

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
                  className="w-full h-full object-cover grayscale"
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
                  <button
                    onClick={startCountdown}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Hand className="w-5 h-5" />
                    Wave to Start
                  </button>
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
                <div className="mt-6 flex justify-center gap-4">
                  <button
                    onClick={() => setState('prints')}
                    className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    OK
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
          )}

          {state === 'prints' && (
            <div className="bg-gray-800 rounded-lg p-8">
              <h2 className="text-xl font-semibold mb-4">Number of Prints</h2>
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setPrints(p => Math.max(1, p - 1))}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-xl"
                >
                  -
                </button>
                <span className="text-2xl font-bold">{prints}</span>
                <button
                  onClick={() => setPrints(p => p + 1)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-xl"
                >
                  +
                </button>
              </div>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 mx-auto"
              >
                <Printer className="w-5 h-5" />
                Print {prints} {prints === 1 ? 'Copy' : 'Copies'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;