import React, { useState, useRef } from 'react';
import { cn } from './lib/utils';

export default function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [error, setError] = useState('');
  const [gridColor, setGridColor] = useState('#ff0000'); // 默认白色
  const [gridOpacity, setGridOpacity] = useState(0.8); // 默认透明度
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setSelectedImage(img);
          drawImageWithGrid(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const validateGridSize = (newRows, newCols) => {
    if (newRows < 1 || newCols < 1) {
      setError('行数和列数必须大于0');
      return false;
    }
    if (newRows > 100 || newCols > 100) {
      setError('为了保持清晰度，行数和列数不能超过100');
      return false;
    }
    setError('');
    return true;
  };

  const handleRowsChange = (e) => {
    // 只允许数字输入
    const value = e.target.value.replace(/[^\d]/g, '');
    const newRows = parseInt(value) || 0;
    if (validateGridSize(newRows, cols)) {
      setRows(newRows);
      if (selectedImage) {
        drawImageWithGrid(selectedImage, newRows, cols);
      }
    }
  };

  const handleColsChange = (e) => {
    // 只允许数字输入
    const value = e.target.value.replace(/[^\d]/g, '');
    const newCols = parseInt(value) || 0;
    if (validateGridSize(rows, newCols)) {
      setCols(newCols);
      if (selectedImage) {
        drawImageWithGrid(selectedImage, rows, newCols);
      }
    }
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setGridColor(newColor);
    if (selectedImage) {
      drawImageWithGrid(selectedImage, rows, cols, newColor, gridOpacity);
    }
  };

  const handleOpacityChange = (e) => {
    const newOpacity = parseFloat(e.target.value);
    setGridOpacity(newOpacity);
    if (selectedImage) {
      drawImageWithGrid(selectedImage, rows, cols, gridColor, newOpacity);
    }
  };

  const drawImageWithGrid = (img, currentRows = rows, currentCols = cols, color = gridColor, opacity = gridOpacity) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw image
    ctx.drawImage(img, 0, 0);
    
    // Draw grid
    const rgba = hexToRgba(color, opacity);
    ctx.strokeStyle = rgba;
    ctx.lineWidth = 2;
    
    // Draw vertical lines
    for (let i = 1; i < currentCols; i++) {
      const x = (canvas.width / currentCols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let i = 1; i < currentRows; i++) {
      const y = (canvas.height / currentRows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    
    // 检测是否是iOS设备
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS设备：打开图片在新窗口，用户可以长按保存
      window.open(imageData);
    } else {
      // 其他设备：使用常规下载方式
      const link = document.createElement('a');
      link.download = `grid-${rows}x${cols}.png`;
      link.href = imageData;
      link.click();
    }
  };

  const presetGrid = (presetRows, presetCols) => {
    if (validateGridSize(presetRows, presetCols)) {
      setRows(presetRows);
      setCols(presetCols);
      if (selectedImage) {
        drawImageWithGrid(selectedImage, presetRows, presetCols);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">图片网格工具</h1>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    行数
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={rows}
                    onChange={handleRowsChange}
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    列数
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cols}
                    onChange={handleColsChange}
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    网格颜色
                  </label>
                  <input
                    type="color"
                    value={gridColor}
                    onChange={handleColorChange}
                    className="w-full h-10"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    透明度 ({(gridOpacity * 100).toFixed(0)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={gridOpacity}
                    onChange={handleOpacityChange}
                    className="w-full"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => presetGrid(3, 3)}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  九宫格 (3×3)
                </button>
                <button
                  onClick={() => presetGrid(48, 33)}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  大宫格 (48×33)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => fileInputRef.current.click()}
                className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
              >
                选择图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto"
              />
            </div>

            {selectedImage && (
              <div className="space-y-2">
                <button
                  onClick={downloadImage}
                  className="w-full bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
                >
                  下载带网格的图片
                </button>
                {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                  <p className="text-sm text-gray-600 text-center">
                    iOS设备请在新窗口打开后，长按图片选择"存储图像"
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}