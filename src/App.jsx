import React, { useState, useRef } from 'react';

export default function App() {
  // 状态定义
  const [selectedImage, setSelectedImage] = useState(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [error, setError] = useState('');
  const [gridColor, setGridColor] = useState('#ff0000');
  const [gridOpacity, setGridOpacity] = useState(0.8);
  const [isSketch, setIsSketch] = useState(false);
  const [sketchDarkness, setSketchDarkness] = useState(0.5);
  
  // refs
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
          drawImageWithGrid(img, rows, cols, gridColor, gridOpacity, sketchDarkness);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawImageWithGrid = (
    img, 
    currentRows = rows, 
    currentCols = cols, 
    color = gridColor, 
    opacity = gridOpacity,
    darkness = sketchDarkness
  ) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw image
    ctx.drawImage(img, 0, 0);

    // 如果启用线稿模式
    if (isSketch) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      // 创建临时数组存储灰度值
      const grayData = new Array(width * height);
      
      // 转换为灰度并存储
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        grayData[i/4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      
      // 应用高斯模糊以减少噪点
      const gaussianBlur = (x, y) => {
        let sum = 0;
        let count = 0;
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const px = x + i;
            const py = y + j;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              sum += grayData[py * width + px];
              count++;
            }
          }
        }
        return Math.round(sum / count);
      };
      
      // 应用Sobel算子检测边缘
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // 计算周围像素的梯度
          const gx = 
            -1 * gaussianBlur(x-1, y-1) +
            -2 * gaussianBlur(x-1, y) +
            -1 * gaussianBlur(x-1, y+1) +
            1 * gaussianBlur(x+1, y-1) +
            2 * gaussianBlur(x+1, y) +
            1 * gaussianBlur(x+1, y+1);
            
          const gy = 
            -1 * gaussianBlur(x-1, y-1) +
            -2 * gaussianBlur(x, y-1) +
            -1 * gaussianBlur(x+1, y-1) +
            1 * gaussianBlur(x-1, y+1) +
            2 * gaussianBlur(x, y+1) +
            1 * gaussianBlur(x+1, y+1);
          
          // 使用 darkness 参数调整线条深浅
          const grad = Math.sqrt(gx * gx + gy * gy);
          const intensity = Math.min(255, Math.pow(grad / 1.5, 0.6) * (2.0 + darkness * 2));
          const value = Math.max(0, 255 - intensity * (1.5 + darkness));
          const finalValue = value < 180 ? value * (0.5 - darkness * 0.3) : value;
          
          data[idx] = data[idx + 1] = data[idx + 2] = finalValue;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
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

  const handleRowsChange = (e) => {
    const newRows = parseInt(e.target.value);
    setRows(newRows);
    if (selectedImage && newRows >= 1 && newRows <= 100) {
      drawImageWithGrid(selectedImage, newRows, cols, gridColor, gridOpacity, sketchDarkness);
    }
  };

  const handleColsChange = (e) => {
    const newCols = parseInt(e.target.value);
    setCols(newCols);
    if (selectedImage && newCols >= 1 && newCols <= 100) {
      drawImageWithGrid(selectedImage, rows, newCols, gridColor, gridOpacity, sketchDarkness);
    }
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setGridColor(newColor);
    if (selectedImage) {
      drawImageWithGrid(selectedImage, rows, cols, newColor, gridOpacity, sketchDarkness);
    }
  };

  const handleOpacityChange = (e) => {
    const newOpacity = parseFloat(e.target.value);
    setGridOpacity(newOpacity);
    if (selectedImage) {
      drawImageWithGrid(selectedImage, rows, cols, gridColor, newOpacity, sketchDarkness);
    }
  };

  const presetGrid = (presetRows, presetCols) => {
    setRows(presetRows);
    setCols(presetCols);
    if (selectedImage) {
      drawImageWithGrid(selectedImage, presetRows, presetCols, gridColor, gridOpacity, sketchDarkness);
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
                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    行数: {rows}
                  </label>
                  <select
                    value={rows}
                    onChange={handleRowsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  >
                    {Array.from({length: 100}, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={rows}
                    onChange={handleRowsChange}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    列数: {cols}
                  </label>
                  <select
                    value={cols}
                    onChange={handleColsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  >
                    {Array.from({length: 100}, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={cols}
                    onChange={handleColsChange}
                    className="w-full"
                  />
                </div>
              </div>

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

              <div className="flex items-center mb-4">
                <input 
                  type="checkbox"
                  id="sketch-mode"
                  checked={isSketch}
                  onChange={(e) => {
                    setIsSketch(e.target.checked);
                    if (selectedImage) {
                      drawImageWithGrid(selectedImage, rows, cols, gridColor, gridOpacity, sketchDarkness);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="sketch-mode" className="ml-2 text-sm font-medium text-gray-700">
                  显示线稿
                </label>
              </div>

              {isSketch && (
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      线稿深浅度 ({Math.round(sketchDarkness * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={sketchDarkness}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value);
                        setSketchDarkness(newValue);
                        if (selectedImage) {
                          drawImageWithGrid(selectedImage, rows, cols, gridColor, gridOpacity, newValue);
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
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
                  onClick={() => {
                    const canvas = canvasRef.current;
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    
                    if (isIOS) {
                      // iOS设备：创建一个临时div来显示图片
                      const wrapper = document.createElement('div');
                      wrapper.style.position = 'fixed';
                      wrapper.style.top = '0';
                      wrapper.style.left = '0';
                      wrapper.style.right = '0';
                      wrapper.style.bottom = '0';
                      wrapper.style.backgroundColor = 'rgba(0,0,0,0.8)';
                      wrapper.style.zIndex = '9999';
                      wrapper.style.display = 'flex';
                      wrapper.style.alignItems = 'center';
                      wrapper.style.justifyContent = 'center';
                      wrapper.style.flexDirection = 'column';
                      
                      const img = document.createElement('img');
                      img.src = canvas.toDataURL('image/png');
                      img.style.maxWidth = '90%';
                      img.style.maxHeight = '80vh';
                      img.style.objectFit = 'contain';
                      
                      const text = document.createElement('p');
                      text.textContent = '长按图片保存';
                      text.style.color = 'white';
                      text.style.marginTop = '20px';
                      text.style.fontFamily = 'system-ui, -apple-system, sans-serif';
                      
                      const closeBtn = document.createElement('button');
                      closeBtn.textContent = '关闭';
                      closeBtn.style.marginTop = '10px';
                      closeBtn.style.padding = '8px 16px';
                      closeBtn.style.border = 'none';
                      closeBtn.style.borderRadius = '4px';
                      closeBtn.style.backgroundColor = 'white';
                      closeBtn.style.color = 'black';
                      
                      closeBtn.onclick = () => document.body.removeChild(wrapper);
                      
                      wrapper.appendChild(img);
                      wrapper.appendChild(text);
                      wrapper.appendChild(closeBtn);
                      
                      // 点击背景关闭
                      wrapper.onclick = (e) => {
                        if (e.target === wrapper) {
                          document.body.removeChild(wrapper);
                        }
                      };
                      
                      document.body.appendChild(wrapper);
                    } else {
                      // 其他设备：使用常规下载方式
                      const link = document.createElement('a');
                      link.download = `grid-${rows}x${cols}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    }
                  }}
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