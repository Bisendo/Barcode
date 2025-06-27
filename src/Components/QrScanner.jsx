import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import {
  FaWhatsapp, FaUserTie, FaCamera, FaBarcode, FaExclamationTriangle,
  FaCopy, FaSpinner, FaWifi, FaLink, FaCalendarAlt, FaPhone,
  FaEnvelope, FaUser, FaShoppingBasket, FaBox, FaSearchPlus,
  FaSearchMinus, FaHistory, FaLightbulb, FaQrcode, FaExternalLinkAlt,
  FaTimes, FaChevronDown, FaChevronUp, FaInfoCircle
} from 'react-icons/fa';
import { MdTextFields, MdNumbers, MdFlashOn, MdFlashOff } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

const BidaScanner = () => {
  // State management
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [activeCamera, setActiveCamera] = useState('environment');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scanHistory, setScanHistory] = useState([]);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [isFetchingProduct, setIsFetchingProduct] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Refs
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const { width, height } = useWindowSize();

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Product lookup APIs
  const PRODUCT_APIS = {
    upc: (code) => `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    ean: (code) => `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    isbn: (code) => `https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`,
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Enhanced product info fetching with better error handling
  const fetchProductInfo = async (code, type) => {
    setIsFetchingProduct(true);
    try {
      let apiUrl;
      
      if (type === 'isbn') {
        apiUrl = PRODUCT_APIS.isbn(code);
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch book data');
        const data = await response.json();
        const bookData = data[`ISBN:${code}`];
        
        if (bookData) {
          return {
            name: bookData.title,
            image: bookData.cover?.large || bookData.cover?.medium || bookData.cover?.small,
            details: {
              Author: bookData.authors?.map(a => a.name).join(', '),
              Publisher: bookData.publishers?.map(p => p.name).join(', '),
              'Publish Date': bookData.publish_date,
              Pages: bookData.number_of_pages,
              ISBN: code
            },
            links: bookData.url ? [{ url: bookData.url, label: 'Open Library' }] : []
          };
        }
        return null;
      } else {
        // For UPC/EAN codes
        apiUrl = PRODUCT_APIS.ean(code);
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch product data');
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
          const product = data.product;
          return {
            name: product.product_name || product.generic_name,
            image: product.image_url,
            details: {
              Brand: product.brands,
              Category: product.categories,
              'Package Info': product.quantity,
              Ingredients: product.ingredients_text,
              'Barcode Type': type === 'isbn' ? 'ISBN' : code.length === 12 ? 'UPC' : 'EAN',
              'Barcode': code
            },
            links: product.link ? [{ url: product.link, label: 'Product Page' }] : []
          };
        }
        return null;
      }
    } catch (err) {
      console.error('Error fetching product info:', err);
      return null;
    } finally {
      setIsFetchingProduct(false);
    }
  };

  // Enhanced result parsing with more formats
  const parseScanResult = useCallback((codeData) => {
    if (!codeData) return null;

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
        icon: <FaWifi className="text-yellow-400" />,
        title: 'WiFi Network',
        fields: [
          { label: 'Network Name (SSID)', value: wifiInfo.ssid, copyable: true },
          { label: 'Password', value: wifiInfo.password, copyable: true, hidden: true },
          { label: 'Encryption', value: wifiInfo.encryption || 'Unknown' }
        ],
        actions: [
          {
            label: 'Connect to WiFi',
            icon: <FaWifi />,
            handler: () => {
              // This would require platform-specific implementation
              alert(`To connect to WiFi:\nNetwork: ${wifiInfo.ssid}\nPassword: ${wifiInfo.password}`);
            }
          }
        ]
      };
    }

    // URL QR Code
    if (codeData.startsWith('http://') || codeData.startsWith('https://')) {
      try {
        const url = new URL(codeData);
        return {
          raw: codeData,
          type: 'url',
          icon: <FaLink className="text-blue-400" />,
          title: 'Website URL',
          subtitle: url.hostname,
          fields: [
            { label: 'URL', value: codeData, copyable: true }
          ],
          actions: [
            {
              label: 'Open in Browser',
              icon: <FaExternalLinkAlt />,
              handler: () => window.open(codeData, '_blank', 'noopener,noreferrer')
            }
          ]
        };
      } catch {
        return {
          raw: codeData,
          type: 'url',
          icon: <FaLink className="text-blue-400" />,
          title: 'Website URL',
          fields: [
            { label: 'URL', value: codeData, copyable: true }
          ],
          actions: [
            {
              label: 'Open in Browser',
              icon: <FaExternalLinkAlt />,
              handler: () => window.open(codeData, '_blank', 'noopener,noreferrer')
            }
          ]
        };
      }
    }

    // Email QR Code
    if (codeData.startsWith('mailto:')) {
      const email = codeData.substring(7);
      const [address, params] = email.split('?');
      let subject = '';
      let body = '';
      
      if (params) {
        const searchParams = new URLSearchParams(params);
        subject = searchParams.get('subject') || '';
        body = searchParams.get('body') || '';
      }

      const fields = [
        { label: 'Email Address', value: address, copyable: true }
      ];
      
      if (subject) fields.push({ label: 'Subject', value: subject, copyable: true });
      if (body) fields.push({ label: 'Body', value: body, copyable: true });

      return {
        raw: codeData,
        type: 'email',
        icon: <FaEnvelope className="text-red-400" />,
        title: 'Email',
        fields,
        actions: [
          {
            label: 'Compose Email',
            icon: <FaEnvelope />,
            handler: () => {
              const mailtoUrl = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}${body ? `${subject ? '&' : '?'}body=${encodeURIComponent(body)}` : ''}`;
              window.open(mailtoUrl, '_blank');
            }
          }
        ]
      };
    }

    // Phone QR Code
    if (codeData.startsWith('tel:')) {
      const phone = codeData.substring(4);
      return {
        raw: codeData,
        type: 'phone',
        icon: <FaPhone className="text-green-400" />,
        title: 'Phone Number',
        fields: [
          { label: 'Phone', value: phone, copyable: true }
        ],
        actions: [
          {
            label: 'Call Number',
            icon: <FaPhone />,
            handler: () => window.open(`tel:${phone}`, '_blank')
          },
          {
            label: 'Send SMS',
            icon: <FaEnvelope />,
            handler: () => window.open(`sms:${phone}`, '_blank')
          }
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
        icon: <FaEnvelope className="text-purple-400" />,
        title: 'SMS Message',
        fields: [
          { label: 'Phone Number', value: number, copyable: true },
          { label: 'Message', value: body, copyable: true }
        ],
        actions: [
          {
            label: 'Send SMS',
            icon: <FaEnvelope />,
            handler: () => window.open(`sms:${number}?body=${encodeURIComponent(body)}`, '_blank')
          }
        ]
      };
    }

    // VCard QR Code (Contact)
    if (codeData.startsWith('BEGIN:VCARD')) {
      const lines = codeData.split('\n');
      const vcardInfo = {
        name: '',
        org: '',
        tel: [],
        email: [],
        url: '',
        address: '',
        note: ''
      };

      lines.forEach(line => {
        if (line.startsWith('FN:')) vcardInfo.name = line.substring(3);
        if (line.startsWith('ORG:')) vcardInfo.org = line.substring(4);
        if (line.startsWith('TEL;') || line.startsWith('TEL:')) vcardInfo.tel.push(line.split(':')[1]);
        if (line.startsWith('EMAIL;') || line.startsWith('EMAIL:')) vcardInfo.email.push(line.split(':')[1]);
        if (line.startsWith('URL:')) vcardInfo.url = line.substring(4);
        if (line.startsWith('ADR:')) vcardInfo.address = line.substring(4).replace(/;/g, ', ');
        if (line.startsWith('NOTE:')) vcardInfo.note = line.substring(5);
      });

      const fields = [];
      if (vcardInfo.name) fields.push({ label: 'Name', value: vcardInfo.name, copyable: true });
      if (vcardInfo.org) fields.push({ label: 'Organization', value: vcardInfo.org, copyable: true });
      if (vcardInfo.tel.length > 0) {
        vcardInfo.tel.forEach((tel, i) => {
          fields.push({ label: i === 0 ? 'Phone' : `Phone ${i + 1}`, value: tel, copyable: true });
        });
      }
      if (vcardInfo.email.length > 0) {
        vcardInfo.email.forEach((email, i) => {
          fields.push({ label: i === 0 ? 'Email' : `Email ${i + 1}`, value: email, copyable: true });
        });
      }
      if (vcardInfo.url) fields.push({ label: 'Website', value: vcardInfo.url, copyable: true });
      if (vcardInfo.address) fields.push({ label: 'Address', value: vcardInfo.address, copyable: true });
      if (vcardInfo.note) fields.push({ label: 'Note', value: vcardInfo.note, copyable: true });

      const actions = [];
      if (vcardInfo.tel.length > 0) {
        actions.push({
          label: 'Call',
          icon: <FaPhone />,
          handler: () => window.open(`tel:${vcardInfo.tel[0]}`, '_blank')
        });
      }
      if (vcardInfo.email.length > 0) {
        actions.push({
          label: 'Email',
          icon: <FaEnvelope />,
          handler: () => window.open(`mailto:${vcardInfo.email[0]}`, '_blank')
        });
      }

      return {
        raw: codeData,
        type: 'vcard',
        icon: <FaUser className="text-pink-400" />,
        title: 'Contact Card',
        fields,
        actions
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
        icon: <FaCalendarAlt className="text-orange-400" />,
        title: 'Calendar Event',
        fields,
        actions: [
          {
            label: 'Add to Calendar',
            icon: <FaCalendarAlt />,
            handler: () => {
              // This would require platform-specific implementation
              alert('This would normally add the event to your calendar');
            }
          }
        ]
      };
    }

    // UPC/EAN Barcodes (typically 12-13 digits)
    if (/^\d{12,13}$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'product',
        codeType: codeData.length === 12 ? 'UPC' : 'EAN',
        icon: <FaShoppingBasket className="text-emerald-400" />,
        title: 'Product Barcode',
        fields: [
          { label: 'Barcode', value: codeData, copyable: true },
          { label: 'Type', value: codeData.length === 12 ? 'UPC' : 'EAN' }
        ],
        canLookup: true
      };
    }

    // ISBN (books)
    if (/^(97(8|9))?\d{9}(\d|X)$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'isbn',
        icon: <FaBox className="text-amber-400" />,
        title: 'Book ISBN',
        fields: [
          { label: 'ISBN', value: codeData, copyable: true }
        ],
        canLookup: true
      };
    }

    // Numeric codes (generic barcodes)
    if (/^\d+$/.test(codeData)) {
      return {
        raw: codeData,
        type: 'numeric',
        icon: <MdNumbers className="text-cyan-400" />,
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
      icon: <MdTextFields className="text-indigo-400" />,
      title: 'Text Content',
      fields: [
        { label: 'Text', value: codeData, copyable: true }
      ]
    };
  }, []);

  // Enhanced date formatting
  const formatDate = (dateStr) => {
    try {
      if (dateStr.length >= 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        if (dateStr.length > 8 && dateStr.includes('T')) {
          const hour = dateStr.substring(9, 11) || '00';
          const minute = dateStr.substring(11, 13) || '00';
          return new Date(`${year}-${month}-${day}T${hour}:${minute}`).toLocaleString();
        }
        return new Date(`${year}-${month}-${day}`).toLocaleDateString();
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Enhanced scanner stop with cleanup
  const stopScanner = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsLoading(false);
    setZoomLevel(1);
    setTorchEnabled(false);
  }, []);

  // Enhanced permission checking
  const checkCameraPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: activeCamera,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
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
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera constraints could not be satisfied. Try switching cameras.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera access is not supported in this browser.');
      } else {
        setError('Could not access camera. Please try again.');
      }
      return false;
    }
    return true;
  }, [activeCamera]);

  // Enhanced zoom with constraints checking
  const applyZoomToStream = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject;
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack || !('getCapabilities' in videoTrack)) {
      console.warn('Zoom not supported by this device');
      return;
    }
  
    try {
      const capabilities = videoTrack.getCapabilities();
      
      if (!capabilities.zoom) {
        console.warn('Zoom is not supported by this device');
        return;
      }
  
      const clampedZoom = Math.min(
        Math.max(zoomLevel, capabilities.zoom.min || 1),
        capabilities.zoom.max || 5
      );
  
      await videoTrack.applyConstraints({
        advanced: [{ zoom: clampedZoom }]
      });
      setZoomLevel(clampedZoom);
    } catch (err) {
      console.error('Error applying zoom:', err);
    }
  }, [zoomLevel]);

  // Enhanced torch control
  const toggleTorch = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject;
    const videoTrack = stream.getVideoTracks()[0];
    
    if (!videoTrack || !('getCapabilities' in videoTrack)) {
      setError('Flash/torch is not supported on this device');
      return;
    }
  
    try {
      const capabilities = videoTrack.getCapabilities();
      
      if (!capabilities.torch) {
        setError('Flash/torch is not supported on this device');
        return;
      }
  
      await videoTrack.applyConstraints({
        advanced: [{ torch: !torchEnabled }]
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Error toggling torch:', err);
      setError('Failed to toggle flash. Your device might not support this feature.');
    }
  }, [torchEnabled]);

  // Enhanced scanner start with better error handling
  const startScanner = useCallback(async () => {
    setError(null);
    setScanResult(null);
    setProductInfo(null);
    setIsLoading(true);

    if (!videoRef.current) {
      setError('Video element not available');
      setIsLoading(false);
      return;
    }

    const hasPerm = await checkCameraPermissions();
    if (!hasPerm) {
      setIsLoading(false);
      return;
    }

    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
      
      const devices = await codeReaderRef.current.listVideoInputDevices();
      setAvailableCameras(devices);
      
      // Try to find the best camera (back camera if environment mode)
      let deviceId;
      if (activeCamera === 'environment' && devices.length > 1) {
        // Prefer rear camera
        const rearCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        deviceId = rearCamera?.deviceId || devices[0].deviceId;
      } else {
        deviceId = devices[0].deviceId;
      }

      // Start decoding
      codeReaderRef.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          try {
            const parsedResult = parseScanResult(result.getText());
            setScanResult(parsedResult);
            setScanHistory(prev => [parsedResult, ...prev].slice(0, 20));
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            
            // Lookup product info if applicable
            if (parsedResult.canLookup) {
              fetchProductInfo(parsedResult.raw, parsedResult.type)
                .then(info => setProductInfo(info));
            }
            
            stopScanner();
          } catch (err) {
            setError('Error processing barcode. Please try again.');
            console.error(err);
          }
        }
        
        if (err) {
          if (err instanceof NotFoundException) {
            // This is normal - just means no code was found yet
            return;
          }
          
          console.error('Scan error:', err);
          let errorMsg = 'Error scanning barcode. Please try again.';
          
          if (err instanceof ChecksumException) {
            errorMsg = 'Barcode checksum error. The code might be damaged.';
          } else if (err instanceof FormatException) {
            errorMsg = 'Unsupported barcode format. Try a different code.';
          }
          
          setError(errorMsg);
          stopScanner();
        }
      });

      // Get video stream
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : activeCamera,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
        setError('Could not start video stream');
        stopScanner();
      });

      setCameraActive(true);
      setIsLoading(false);
      
      // Apply initial zoom after a short delay to ensure stream is ready
      setTimeout(() => {
        applyZoomToStream();
        if (torchEnabled) toggleTorch();
      }, 500);
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
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Requested camera configuration is not available. Try switching cameras.';
      } else {
        errorMessage = `Camera error: ${err.message}`;
      }
      
      setError(errorMessage);
      console.error(err);
      setIsLoading(false);
    }
  }, [parseScanResult, stopScanner, hasPermission, activeCamera, checkCameraPermissions, applyZoomToStream, torchEnabled, toggleTorch]);

  // Toggle between front and back cameras
  const toggleCamera = () => {
    setActiveCamera(prev => prev === 'environment' ? 'user' : 'environment');
    stopScanner();
    setTimeout(startScanner, 300);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 1));
  };

  // Apply zoom when zoom level changes
  useEffect(() => {
    if (cameraActive) {
      applyZoomToStream();
    }
  }, [zoomLevel, cameraActive, applyZoomToStream]);

  // Cleanup on unmount
  useEffect(() => {
    checkCameraPermissions();
    
    return () => {
      stopScanner();
    };
  }, [stopScanner, checkCameraPermissions]);

  // Copy to clipboard helper
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show a temporary notification
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-out';
        notification.textContent = 'Copied to clipboard!';
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.classList.add('opacity-0', 'transition-opacity', 'duration-300');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        setError('Failed to copy to clipboard');
      });
  };

  // Request camera access explicitly
  const requestCameraAccess = async () => {
    try {
      const hasPerm = await checkCameraPermissions();
      if (hasPerm) {
        startScanner();
      }
    } catch (err) {
      setError('Camera access was denied. Please enable camera permissions in your browser settings.');
    }
  };

  // Load from history
  const loadFromHistory = (item) => {
    setScanResult(item);
    setShowHistory(false);
    
    // Lookup product info if applicable
    if (item.canLookup) {
      fetchProductInfo(item.raw, item.type)
        .then(info => setProductInfo(info));
    }
  };

  // Clear history
  const clearHistory = () => {
    setScanHistory([]);
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
  };

  const slideIn = {
    hidden: { opacity: 0, x: 100 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 p-4 md:p-6">
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={800}
          gravity={0.3}
          initialVelocityY={10}
          confettiSource={{ x: width / 2, y: height / 2, w: 10, h: 10 }}
        />
      )}
      
      {/* Main container */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-3xl mx-auto bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10"
      >
        {/* Header section */}
        <div className="text-center p-6 md:p-8 relative">
          {/* Control buttons */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 bg-black/20 rounded-full text-white hover:bg-white/20 transition-all"
              title="Scan History"
            >
              <FaHistory />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 bg-black/20 rounded-full text-white hover:bg-white/20 transition-all"
              title="Help"
            >
              <FaLightbulb />
            </motion.button>
          </div>
          
          {/* Animated title */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="mb-4"
          >
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 mb-2">
              Bida Scanner
            </h1>
            <p className="text-white/80 text-sm md:text-base">
              Advanced barcode and QR code scanner with product lookup
            </p>
          </motion.div>
        </div>

        {/* Help Section */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-4 mb-4 bg-blue-900/20 rounded-xl overflow-hidden border border-blue-800/30"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <FaLightbulb className="mr-2 text-yellow-300" /> Scanner Help
                  </h3>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-1 text-white/70 hover:text-white"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex items-start">
                    <FaQrcode className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>Supported formats:</strong> QR codes, barcodes (UPC, EAN, ISBN), WiFi, URLs, contacts, events, and more</p>
                  </div>
                  <div className="flex items-start">
                    <FaSearchPlus className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>Zoom:</strong> Use the + and - buttons to adjust zoom level (if supported by your device)</p>
                  </div>
                  <div className="flex items-start">
                    <MdFlashOn className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>Flash:</strong> Toggle the flash icon to enable/disable torch (if supported by your device)</p>
                  </div>
                  <div className="flex items-start">
                    <FaCamera className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>Camera:</strong> Switch between front and rear cameras (if multiple cameras are available)</p>
                  </div>
                  <div className="flex items-start">
                    <FaHistory className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>History:</strong> View your previous scans in the history panel (up to 20 scans)</p>
                  </div>
                  <div className="flex items-start">
                    <FaShoppingBasket className="mt-1 mr-2 flex-shrink-0" />
                    <p><strong>Product Lookup:</strong> For product barcodes, we'll automatically try to find product information</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-4 mb-4 bg-purple-900/20 rounded-xl overflow-hidden border border-purple-800/30"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <FaHistory className="mr-2 text-purple-300" /> Scan History
                  </h3>
                  <div className="flex items-center space-x-2">
                    {scanHistory.length > 0 && (
                      <button
                        onClick={clearHistory}
                        className="text-sm text-red-300 hover:text-red-200 px-2 py-1 rounded"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-1 text-white/70 hover:text-white"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
                
                {scanHistory.length === 0 ? (
                  <div className="p-4 text-center text-white/70">
                    <FaHistory className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No scan history yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {scanHistory.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => loadFromHistory(item)}
                        className="p-3 bg-black/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center">
                          <div className="mr-3 text-xl">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{item.title}</p>
                            <p className="text-white/60 text-xs truncate">
                              {item.fields[0]?.value || 'No content'}
                            </p>
                          </div>
                          <div className="text-xs text-white/40">
                            {new Date().toLocaleTimeString()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanner Section */}
        <div className="mb-6 rounded-2xl overflow-hidden mx-4">
          <div className="relative aspect-square bg-black/30 rounded-2xl overflow-hidden">
            {/* Video element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
              style={{ transform: `scale(${zoomLevel})` }}
            />
            
            {/* Scanner overlay when inactive */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4">
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <FaSpinner className="h-20 w-20 text-white animate-spin mb-4" />
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <FaBarcode className="h-20 w-20 text-white mb-4" />
                    </motion.div>
                    <p className="text-white/80 text-center">
                      {hasPermission === false 
                        ? 'Camera access required'
                        : 'Ready to scan barcodes and QR codes'}
                    </p>
                  </>
                )}
              </div>
            )}
            
            {/* Animated scanner frame */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 border-4 border-yellow-400/80 rounded-xl">
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-1 bg-yellow-400 shadow-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, y: [0, 256, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-yellow-400"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-yellow-400"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-yellow-400"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-yellow-400"></div>
                </div>
              </div>
            )}

            {/* Camera Controls */}
            {cameraActive && (
              <>
                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 5}
                    className={`p-2 bg-black/50 rounded-full text-white ${zoomLevel >= 5 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/30'}`}
                    title="Zoom In"
                  >
                    <FaSearchPlus />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    className={`p-2 bg-black/50 rounded-full text-white ${zoomLevel <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/30'}`}
                    title="Zoom Out"
                  >
                    <FaSearchMinus />
                  </motion.button>
                </div>

                {/* Torch Control */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleTorch}
                  className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white hover:bg-white/30"
                  title={torchEnabled ? 'Turn off flash' : 'Turn on flash'}
                >
                  {torchEnabled ? <MdFlashOn className="text-yellow-300" /> : <MdFlashOff />}
                </motion.button>

                {/* Zoom Level Indicator */}
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/50 rounded-full text-white text-xs backdrop-blur-sm">
                  {zoomLevel.toFixed(1)}x
                </div>

                {/* Camera Switch */}
                {availableCameras.length > 1 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleCamera}
                    className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 rounded-full text-white text-sm hover:bg-white/30 backdrop-blur-sm"
                  >
                    {activeCamera === 'environment' ? 'Front' : 'Rear'} Cam
                  </motion.button>
                )}
              </>
            )}
          </div>

          {/* Scanner Controls */}
          <div className="p-4 bg-white/10 border-t border-white/10">
            <div className="flex justify-between gap-3">
              {!cameraActive ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={hasPermission === false ? requestCameraAccess : startScanner}
                  disabled={isLoading}
                  className={`flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-yellow-500 to-pink-500 hover:from-yellow-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all shadow-lg ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <FaSpinner className="h-5 w-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FaCamera className="h-5 w-5 mr-2" />
                      {hasPermission === false ? 'Grant Camera Access' : 'Start Scanner'}
                    </>
                  )}
                </motion.button>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={stopScanner}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-purple-500 hover:from-red-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all shadow-lg"
                  >
                    Stop Scanner
                  </motion.button>
                  {availableCameras.length > 1 && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={toggleCamera}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all shadow-lg"
                    >
                      {activeCamera === 'environment' ? 'Switch to Front' : 'Switch to Rear'}
                    </motion.button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-4 mb-6 p-4 bg-red-500/20 border-l-4 border-red-500 rounded-lg shadow-sm flex items-start"
            >
              <FaExclamationTriangle className="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-white">{error}</span>
                {error.includes('denied') && (
                  <button
                    onClick={requestCameraAccess}
                    className="mt-2 block text-sm text-yellow-300 hover:text-yellow-200 underline"
                  >
                    Try again
                  </button>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-2 text-white/70 hover:text-white"
              >
                <FaTimes />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan Results */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="m-4 bg-white/10 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-white/10"
            >
              {/* Result header */}
              <div className="p-5 bg-gradient-to-r from-yellow-500/10 to-pink-500/10">
                <div className="flex items-center">
                  <div className="mr-3 text-3xl">
                    {scanResult.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{scanResult.title}</h2>
                    <p className="text-sm text-white/70">
                      {scanResult.subtitle || 'Scan successful!'}
                      {scanResult.codeType && ` • ${scanResult.codeType}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result content */}
              <div className="p-5">
                <div className="space-y-4">
                  {scanResult.fields.map((field, index) => (
                    <div key={index}>
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        {field.label}
                      </h3>
                      <div className="flex items-center mt-1">
                        <p className={`text-base font-mono bg-black/20 text-white px-3 py-2 rounded-lg flex-grow ${field.hidden ? 'filter blur-sm hover:filter-none transition-all cursor-pointer' : ''}`}
                          onClick={field.hidden ? () => {} : null}>
                          {field.value || 'Not specified'}
                        </p>
                        {field.copyable && field.value && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => copyToClipboard(field.value)}
                            className="ml-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                            title="Copy to clipboard"
                          >
                            <FaCopy />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Product Information */}
                {scanResult.canLookup && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection('productInfo')}>
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        Product Information
                      </h3>
                      {expandedSections.productInfo ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                    
                    <AnimatePresence>
                      {expandedSections.productInfo && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {isFetchingProduct ? (
                            <div className="flex justify-center py-6">
                              <FaSpinner className="h-6 w-6 animate-spin text-white" />
                            </div>
                          ) : productInfo ? (
                            <div className="mt-3 bg-black/20 rounded-lg p-4">
                              {productInfo.image && (
                                <div className="flex justify-center mb-4">
                                  <img 
                                    src={productInfo.image} 
                                    alt={productInfo.name} 
                                    className="max-h-40 rounded-lg shadow-md"
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                </div>
                              )}
                              {productInfo.name && (
                                <h4 className="text-lg font-bold text-white mb-3">{productInfo.name}</h4>
                              )}
                              {productInfo.details && Object.entries(productInfo.details).map(([key, value]) => (
                                value && (
                                  <div key={key} className="mb-2 last:mb-0">
                                    <span className="text-sm font-semibold text-white/70">{key}: </span>
                                    <span className="text-sm text-white">{value}</span>
                                  </div>
                                )
                              ))}
                              {productInfo.links && productInfo.links.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {productInfo.links.map((link, index) => (
                                    <motion.a
                                      key={index}
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-2 bg-blue-600/30 hover:bg-blue-600/40 rounded-lg text-white text-sm"
                                    >
                                      <FaExternalLinkAlt className="mr-2" />
                                      {link.label}
                                    </motion.a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 p-4 bg-black/20 rounded-lg text-center text-white/70">
                              <FaInfoCircle className="mx-auto h-5 w-5 mb-2" />
                              No product information found for this barcode
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Action Buttons */}
                {scanResult.actions && scanResult.actions.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {scanResult.actions.map((action, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={action.handler}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-xl transition-all shadow-lg flex items-center justify-center"
                      >
                        {action.icon && (
                          <span className="mr-2">{action.icon}</span>
                        )}
                        {action.label}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Raw Data Section */}
                <div className="mt-6">
                  <div className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('rawData')}>
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Raw Data
                    </h3>
                    {expandedSections.rawData ? <FaChevronUp /> : <FaChevronDown />}
                  </div>
                  
                  <AnimatePresence>
                    {expandedSections.rawData && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2"
                      >
                        <div className="relative">
                          <textarea
                            readOnly
                            value={scanResult.raw}
                            className="w-full h-32 p-3 bg-black/20 text-white rounded-lg font-mono text-sm"
                          />
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => copyToClipboard(scanResult.raw)}
                            className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg shadow-sm text-white transition-all"
                            title="Copy to clipboard"
                          >
                            <FaCopy className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Scan Another Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startScanner}
                  className="mt-6 w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-pink-500 hover:from-yellow-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all shadow-lg"
                >
                  Scan Another Code
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center text-sm text-white/70 p-6 pt-0">
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <FaQrcode className="mr-2 text-yellow-300" />
              <p className="font-medium">Bida Barcode Scanner</p>
            </div>
            <p className="mb-1">Point your camera at any barcode or QR code</p>
            <p className="mb-4">Supports products, WiFi, URLs, contacts, and more</p>
            
            {/* Social Links */}
            <div className="flex justify-center space-x-4 mt-4">
              {/* WhatsApp */}
              <motion.a 
                href="https://wa.me/255621690364" 
                target="_blank" 
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                className="text-white hover:text-green-400 transition-colors"
                title="Contact us on WhatsApp"
              >
                <FaWhatsapp className="h-5 w-5" />
              </motion.a>
              
              {/* Email */}
              <motion.a 
                href="mailto:kimotobidaus@.com" 
                whileHover={{ y: -2 }}
                className="text-white hover:text-red-400 transition-colors"
                title="Email us"
              >
                <FaEnvelope className="h-5 w-5" />
              </motion.a>
              
              {/* CEO Profile */}
              <motion.a 
                href="https://www.linkedin.com/in/bidaus-kimoto-606690263/" 
                target="_blank" 
                rel="noopener noreferrer"
                whileHover={{ y: -2 }}
                className="text-white hover:text-blue-400 transition-colors"
                title="CEO Profile"
              >
                <FaUserTie className="h-5 w-5" />
              </motion.a>
            </div>
          </div>
          
          {/* Copyright */}
          <div className="mt-4 text-xs text-white/50 border-t border-white/10 pt-4">
            <p>© {new Date().getFullYear()} Bida Scanner. All rights reserved.</p>
            <p className="mt-1">Version 4.2.0</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BidaScanner;