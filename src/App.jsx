import React, { useState, useRef } from 'react';
import { cn } from './lib/utils';

export default function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [error, setError] = useState('');
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
    if (newRows > 20 || newCols > 20) {
      setError('为了保持清晰度，行数和列数不能超过20');
      return false;
    }
    setError('');
    return true;
  };

  const handleRowsChange = (e) => {
    const newRows = parseInt(e.target.value) || 0;
    if (validateGridSize(newRows, cols)) {
      setRows(newRows);
      if (selectedImage) {
        drawImageWithGrid(selectedImage, newRows, cols);
      }
    }
  };

  const handleColsChange = (e) => {
    const newCols = parseInt(e.target.value) || 0;
    if (validateGridSize(rows, newCols)) {
      setCols(newCols);
      if (selectedImage) {
        drawImageWithGrid(selectedImage, rows, newCols);
      }
    }
  };

  const drawImageWithGrid = (img, currentRows = rows, currentCols = cols) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw image
    ctx.drawImage(img, 0, 0);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
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

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `grid-${rows}x${cols}.png`;
    link.href = canvas.toDataURL();
    link.click();
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
                    type="number"
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
                    type="number"
                    value={cols}
                    onChange={handleColsChange}
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  onClick={() => presetGrid(4, 6)}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  24宫格 (4×6)
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
              <button
                onClick={downloadImage}
                className="w-full bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
              >
                下载带网格的图片
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}