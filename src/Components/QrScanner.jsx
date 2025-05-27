import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
  FaCamera,
  FaBarcode,
  FaExclamationTriangle,
  FaCopy,
  FaSpinner,
  FaWifi,
  FaLink,
  FaCalendarAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
  FaShoppingBasket,
  FaBox,
  
} from 'react-icons/fa';
import { MdTextFields, MdNumbers } from 'react-icons/md';

const BarcodeScannerComponent = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [activeCamera, setActiveCamera] = useState('environment');
  const [availableCameras, setAvailableCameras] = useState([]);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  // Determine code type and extract relevant information
  const parseScanResult = useCallback((codeData) => {
    // WiFi QR Code
    if (codeData.startsWith('WIFI:')) {
      const parts = codeData.substring(5).split(';');
      const wifiInfo = { ssid: '', password: '', encryption: '' };
      
      parts.forEach(part => {
        if (part.startsWith('T:')) wifiInfo.encryption = part.substring(2);
        if (part.startsWith('S:')) wifiInfo.ssid = part.substring(2);
        if (part.startsWith('P:')) wifiInfo.password = part.substring(2);
      });

      return {
        raw: codeData,
        type: 'wifi',
        icon: <FaWifi className="text-blue-500" />,
        title: 'WiFi Network',
        fields: [
          { label: 'Network Name (SSID)', value: wifiInfo.ssid, copyable: true },
          { label: 'Password', value: wifiInfo.password, copyable: true, hidden: true },
          { label: 'Encryption', value: wifiInfo.encryption || 'Unknown' }
        ]
      };
    }

    // URL QR Code
    if (codeData.startsWith('http://') || codeData.startsWith('https://')) {
      return {
        raw: codeData,
        type: 'url',
        icon: <FaLink className="text-blue-500" />,
        title: 'Website URL',
        fields: [
          { label: 'URL', value: codeData, copyable: true }
        ]
      };
    }

    // Email QR Code
    if (codeData.startsWith('mailto:')) {
      const email = codeData.substring(7);
      return {
        raw: codeData,
        type: 'email',
        icon: <FaEnvelope className="text-blue-500" />,
        title: 'Email Address',
        fields: [
          { label: 'Email', value: email, copyable: true }
        ]
      };
    }

    // Phone QR Code
    if (codeData.startsWith('tel:')) {
      const phone = codeData.substring(4);
      return {
        raw: codeData,
        type: 'phone',
        icon: <FaPhone className="text-blue-500" />,
        title: 'Phone Number',
        fields: [
          { label: 'Phone', value: phone, copyable: true }
        ]
      };
    }

    // SMS QR Code
    if (codeData.startsWith('sms:')) {
      const parts = codeData.substring(4).split('?');
      const number = parts[0];
      let body = '';
      
      if (parts[1]) {
        const params = new URLSearchParams(parts[1]);
        body = params.get('body') || '';
      }

      return {
        raw: codeData,
        type: 'sms',
        icon: <FaEnvelope className="text-blue-500" />,
        title: 'SMS Message',
        fields: [
          { label: 'Phone Number', value: number, copyable: true },
          { label: 'Message', value: body, copyable: true }
        ]
      };
    }

    // VCard QR Code
    if (codeData.startsWith('BEGIN:VCARD')) {
      const lines = codeData.split('\n');
      const vcardInfo = {
        name: '',
        org: '',
        tel: '',
        email: '',
        url: '',
        address: ''
      };

      lines.forEach(line => {
        if (line.startsWith('FN:')) vcardInfo.name = line.substring(3);
        if (line.startsWith('ORG:')) vcardInfo.org = line.substring(4);
        if (line.startsWith('TEL:')) vcardInfo.tel = line.substring(4);
        if (line.startsWith('EMAIL:')) vcardInfo.email = line.substring(6);
        if (line.startsWith('URL:')) vcardInfo.url = line.substring(4);
        if (line.startsWith('ADR:')) vcardInfo.address = line.substring(4).replace(/;/g, ', ');
      });

      const fields = [];
      if (vcardInfo.name) fields.push({ label: 'Name', value: vcardInfo.name, copyable: true });
      if (vcardInfo.org) fields.push({ label: 'Organization', value: vcardInfo.org, copyable: true });
      if (vcardInfo.tel) fields.push({ label: 'Phone', value: vcardInfo.tel, copyable: true });
      if (vcardInfo.email) fields.push({ label: 'Email', value: vcardInfo.email, copyable: true });
      if (vcardInfo.url) fields.push({ label: 'Website', value: vcardInfo.url, copyable: true });
      if (vcardInfo.address) fields.push({ label: 'Address', value: vcardInfo.address, copyable: true });

      return {
        raw: codeData,
        type: 'vcard',
        icon: <FaUser className="text-blue-500" />,
        title: 'Contact Card',
        fields
      };
    }

    // Calendar Event QR Code
    if (codeData.startsWith('BEGIN:VEVENT')) {
      const lines = codeData.split('\n');
      const eventInfo = {
        summary: '',
        start: '',
        end: '',
        location: '',
        description: ''
      };

      lines.forEach(line => {
        if (line.startsWith('SUMMARY:')) eventInfo.summary = line.substring(8);
        if (line.startsWith('DTSTART:')) eventInfo.start = line.substring(8);
        if (line.startsWith('DTEND:')) eventInfo.end = line.substring(6);
        if (line.startsWith('LOCATION:')) eventInfo.location = line.substring(9);
        if (line.startsWith('DESCRIPTION:')) eventInfo.description = line.substring(12);
      });

      const fields = [];
      if (eventInfo.summary) fields.push({ label: 'Event', value: eventInfo.summary });
      if (eventInfo.start) fields.push({ label: 'Start', value: formatDate(eventInfo.start) });
      if (eventInfo.end) fields.push({ label: 'End', value: formatDate(eventInfo.end) });
      if (eventInfo.location) fields.push({ label: 'Location', value: eventInfo.location });
      if (eventInfo.description) fields.push({ label: 'Description', value: eventInfo.description });

      return {
        raw: codeData,
        type: 'event',
        icon: <FaCalendarAlt className="text-blue-500" />,
        title: 'Calendar Event',
        fields
      };
    }

    // UPC/EAN Barcodes (typically 12-13 digits)
    if (/^\d{12,13}$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'product',
        icon: <FaShoppingBasket className="text-blue-500" />,
        title: 'Product Barcode',
        fields: [
          { label: 'Barcode', value: codeData, copyable: true }
        ]
      };
    }

    // ISBN (books)
    if (/^(97(8|9))?\d{9}(\d|X)$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'isbn',
        icon: <FaBox className="text-blue-500" />,
        title: 'Book ISBN',
        fields: [
          { label: 'ISBN', value: codeData, copyable: true }
        ]
      };
    }

    // Numeric codes (generic barcodes)
    if (/^\d+$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'numeric',
        icon: <MdNumbers className="text-blue-500" />,
        title: 'Numeric Code',
        fields: [
          { label: 'Code', value: codeData, copyable: true }
        ]
      };
    }

    // Plain text
    return {
      raw: codeData,
      type: 'text',
      icon: <MdTextFields className="text-blue-500" />,
      title: 'Text Content',
      fields: [
        { label: 'Text', value: codeData, copyable: true }
      ]
    };
  }, []);

  const formatDate = (dateStr) => {
    try {
      if (dateStr.length >= 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        if (dateStr.length > 8 && dateStr.includes('T')) {
          const hour = dateStr.substring(9, 11) || '00';
          const minute = dateStr.substring(11, 13) || '00';
          return `${year}-${month}-${day} ${hour}:${minute}`;
        }
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const stopScanner = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    setIsLoading(false);
  }, []);

  const checkCameraPermissions = useCallback(async () => {
    try {
      // Chrome requires a direct check rather than permissions API
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // List available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // Stop the stream immediately after checking
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      
      if (videoDevices.length === 0) {
        setError('No cameras found on this device.');
      }
    } catch (err) {
      console.error('Camera permission error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Camera access was denied. Please enable camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setScanResult(null);
    setIsLoading(true);

    if (!videoRef.current) {
      setError('Video element not available');
      setIsLoading(false);
      return;
    }

    // In Chrome, we need to check permissions each time
    await checkCameraPermissions();
    
    if (hasPermission === false) {
      setIsLoading(false);
      return;
    }

    try {
      // Initialize the barcode reader
      codeReaderRef.current = new BrowserMultiFormatReader();
      
      // Get the list of available cameras
      const devices = await codeReaderRef.current.listVideoInputDevices();
      setAvailableCameras(devices);
      
      // Determine which camera to use
      const deviceId = activeCamera === 'environment' && devices.length > 1 ? 
        devices.find(d => d.label.toLowerCase().includes('back'))?.deviceId || 
        devices[0].deviceId : 
        devices[0].deviceId;

      // Start decoding
      codeReaderRef.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          try {
            const parsedResult = parseScanResult(result.getText());
            setScanResult(parsedResult);
            stopScanner();
          } catch (err) {
            setError('Error processing barcode. Please try again.');
            console.error(err);
          }
        }
        
        if (err && !(err.name === 'NotFoundException')) {
          console.error(err);
          setError('Error scanning barcode. Please try again.');
        }
      });

      setCameraActive(true);
      setIsLoading(false);
    } catch (err) {
      let errorMessage = 'Could not access the camera.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access was denied. Please grant permission to use the camera.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'This browser does not support camera access.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      }
      
      setError(errorMessage);
      console.error(err);
      setIsLoading(false);
    }
  }, [parseScanResult, stopScanner, hasPermission, activeCamera, checkCameraPermissions]);

  const toggleCamera = () => {
    setActiveCamera(prev => prev === 'environment' ? 'user' : 'environment');
    stopScanner();
    setTimeout(startScanner, 300);
  };

  useEffect(() => {
    checkCameraPermissions();
    
    return () => {
      stopScanner();
    };
  }, [stopScanner, checkCameraPermissions]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // You could add a toast notification here
        console.log('Copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  };

  const requestCameraAccess = async () => {
    try {
      await checkCameraPermissions();
      if (hasPermission !== false) {
        startScanner();
      }
    } catch (err) {
      setError('Camera access was denied. Please enable camera permissions in your browser settings.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-lg overflow-hidden">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
          Universal Barcode Scanner
        </h1>
        <p className="text-gray-600">Scan any barcode or QR code to reveal its contents</p>
      </div>

      {/* Scanner Section */}
      <div className="mb-6 bg-white rounded-xl shadow-md overflow-hidden">
        <div className="relative aspect-square bg-gray-200">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            playsInline
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
              {isLoading ? (
                <FaSpinner className="h-20 w-20 text-gray-400 animate-spin mb-4" />
              ) : (
                <>
                  <FaBarcode className="h-20 w-20 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-center">
                    {hasPermission === false 
                      ? 'Camera access required to scan barcodes'
                      : 'Scanner is ready'}
                  </p>
                </>
              )}
            </div>
          )}
          
          {/* Scanner frame overlay */}
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-64 border-4 border-blue-400 rounded-xl">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-400"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-400"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-400"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-400"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex justify-between gap-3">
            {!cameraActive ? (
              <button
                onClick={hasPermission === false ? requestCameraAccess : startScanner}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <FaSpinner className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <FaCamera className="h-5 w-5 mr-2" />
                )}
                {hasPermission === false ? 'Grant Access' : 'Start Scanner'}
              </button>
            ) : (
              <>
                <button
                  onClick={stopScanner}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all shadow-md"
                >
                  Stop
                </button>
                {availableCameras.length > 1 && (
                  <button
                    onClick={toggleCamera}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium rounded-lg transition-all shadow-md"
                  >
                    {activeCamera === 'environment' ? 'Front Camera' : 'Rear Camera'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
          <div className="flex items-start">
            <FaExclamationTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-red-700">{error}</span>
              {error.includes('denied') && (
                <button
                  onClick={requestCameraAccess}
                  className="mt-2 block text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <div className="mb-6 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center">
              <div className="mr-3 text-3xl">
                {scanResult.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{scanResult.title}</h2>
                <p className="text-sm text-gray-500">Code scanned successfully</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              {scanResult.fields.map((field, index) => (
                <div key={index}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {field.label}
                  </h3>
                  <div className="flex items-center mt-1">
                    <p className={`text-base font-mono bg-gray-50 px-3 py-2 rounded-lg flex-grow ${field.hidden ? 'filter blur-sm hover:filter-none transition-all' : ''}`}>
                      {field.value || 'Not specified'}
                    </p>
                    {field.copyable && field.value && (
                      <button
                        onClick={() => copyToClipboard(field.value)}
                        className="ml-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                        title="Copy to clipboard"
                      >
                        <FaCopy />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Raw Data
              </h3>
              <div className="relative">
                <textarea
                  readOnly
                  value={scanResult.raw}
                  className="w-full h-32 p-3 bg-gray-50 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(scanResult.raw)}
                  className="absolute top-2 right-2 p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-lg shadow-sm text-gray-700 transition-all"
                  title="Copy to clipboard"
                >
                  <FaCopy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={startScanner}
              className="mt-6 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md"
            >
              Scan Another Code
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-center text-sm text-gray-500">
        <p className="mb-1">Point your camera at any barcode or QR code</p>
        <p>Supports products, books, WiFi, URLs, contacts, and more</p>
      </div>
    </div>
  );
};

export default BarcodeScannerComponent;