import React, { useState, useRef, useEffect } from 'react';
import { cn } from './lib/utils';

export default function App() {
  // 状态定义
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [error, setError] = useState('');
  const [gridColor, setGridColor] = useState('#ff0000');
  const [gridOpacity, setGridOpacity] = useState(0.8);
  const [isSketch, setIsSketch] = useState(false);
  const [sketchDarkness, setSketchDarkness] = useState(0.5);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // refs
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const handleImageUpload = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const newImages = [];
      let loadedCount = 0;
      
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              // 随机放置在画布上，避免完全重叠
              const randomX = Math.random() * 200;
              const randomY = Math.random() * 200;
              
              newImages.push({
                img: img,
                name: file.name,
                scale: 0.5, // 初始缩放比例小一些，更容易管理多图
                x: randomX,
                y: randomY,
                width: img.width,
                height: img.height,
                visible: true
              });
              
              loadedCount++;
              if (loadedCount === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
                setImages(prevImages => [...prevImages, ...newImages]);
                drawCanvas();
              }
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 设置固定的Canvas大小
    const FIXED_WIDTH = 1051;
    const FIXED_HEIGHT = 1500;
    
    canvas.width = FIXED_WIDTH;
    canvas.height = FIXED_HEIGHT;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制所有可见的图片
    images.forEach((image, index) => {
      if (!image.visible) return;
      
      const img = image.img;
      const scaledWidth = img.width * image.scale;
      const scaledHeight = img.height * image.scale;
      
      // 绘制图片
      ctx.drawImage(
        img, 
        0, 0, img.width, img.height,
        image.x, image.y, scaledWidth, scaledHeight
      );
      
      // 如果是选中的图片，绘制边框
      if (index === selectedImageIndex) {
        ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(image.x, image.y, scaledWidth, scaledHeight);
        ctx.setLineDash([]);
      }
    });

    // 如果启用线稿模式，为整个画布应用线稿效果
    if (isSketch) {
      applySketchEffect(ctx, canvas.width, canvas.height, sketchDarkness);
    }
    
    // 绘制网格
    drawGrid(ctx, canvas.width, canvas.height, gridColor, gridOpacity);
  };

  // 将线稿效果提取为独立函数
  const applySketchEffect = (ctx, width, height, darkness) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
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
  };

  // 将网格绘制提取为独立函数
  const drawGrid = (ctx, width, height, color, opacity) => {
    const rgba = hexToRgba(color, opacity);
    ctx.strokeStyle = rgba;
    ctx.lineWidth = 2;
    
    // 使用固定大小的网格 (32x32)
    const GRID_SIZE = 32;
    
    // 绘制垂直线
    for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setGridColor(newColor);
    drawCanvas();
  };

  const handleOpacityChange = (e) => {
    const newOpacity = parseFloat(e.target.value);
    setGridOpacity(newOpacity);
    drawCanvas();
  };

  // 检查点击位置是否在图片上
  const getImageAtPosition = (x, y) => {
    // 逆序检查，因为后添加的图片在上层
    for (let i = images.length - 1; i >= 0; i--) {
      const image = images[i];
      if (!image.visible) continue;
      
      const scaledWidth = image.img.width * image.scale;
      const scaledHeight = image.img.height * image.scale;
      
      if (
        x >= image.x && 
        x <= image.x + scaledWidth && 
        y >= image.y && 
        y <= image.y + scaledHeight
      ) {
        return i;
      }
    }
    return -1;
  };

  // 鼠标/触摸事件处理
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const imageIndex = getImageAtPosition(x, y);
    
    if (imageIndex !== -1) {
      setSelectedImageIndex(imageIndex);
      setIsDragging(true);
      setDragStart({ x, y });
    } else {
      setSelectedImageIndex(-1);
    }
    
    drawCanvas();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || selectedImageIndex === -1) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[selectedImageIndex] = {
        ...newImages[selectedImageIndex],
        x: newImages[selectedImageIndex].x + dx,
        y: newImages[selectedImageIndex].y + dy
      };
      return newImages;
    });
    
    setDragStart({ x, y });
    drawCanvas();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // 图片缩放功能
  const handleScaleChange = (e) => {
    if (selectedImageIndex === -1) return;
    
    const newScale = parseFloat(e.target.value);
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[selectedImageIndex] = {
        ...newImages[selectedImageIndex],
        scale: newScale
      };
      return newImages;
    });
    
    drawCanvas();
  };

  // 移除图片
  const removeSelectedImage = () => {
    if (selectedImageIndex === -1) return;
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[selectedImageIndex].visible = false;
      return newImages;
    });
    
    setSelectedImageIndex(-1);
    drawCanvas();
  };

  // 删除图片
  const deleteSelectedImage = () => {
    if (selectedImageIndex === -1) return;
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages.splice(selectedImageIndex, 1);
      return newImages;
    });
    
    setSelectedImageIndex(-1);
    drawCanvas();
  };

  // 重新显示图片
  const showImage = (index) => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[index].visible = true;
      return newImages;
    });
    
    setSelectedImageIndex(index);
    drawCanvas();
  };

  const downloadImage = () => {
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
      link.download = 'grid-image.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  // 当组件挂载时，设置事件监听器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      canvas.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        canvas.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [selectedImageIndex, isDragging, dragStart, images]);

  // 当任何相关状态变化时，重绘画布
  useEffect(() => {
    drawCanvas();
  }, [selectedImageIndex, isSketch, sketchDarkness, gridColor, gridOpacity]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">图片网格工具</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：图片列表和上传 */}
            <div className="lg:col-span-1 space-y-4">
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
                multiple
                className="hidden"
              />
              
              <div className="space-y-4">
                <div className="border p-2 rounded-md h-60 overflow-y-auto">
                  <h3 className="font-medium mb-2">可见图片:</h3>
                  {images.filter(img => img.visible).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无可见图片</p>
                  ) : (
                    <ul className="space-y-2">
                      {images.map((image, index) => {
                        if (!image.visible) return null;
                        return (
                          <li 
                            key={index}
                            className={`px-3 py-2 cursor-pointer rounded flex items-center justify-between ${selectedImageIndex === index ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
                            onClick={() => setSelectedImageIndex(index)}
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="w-8 h-8 bg-gray-200 flex-shrink-0 mr-2 overflow-hidden">
                                <img 
                                  src={image.img.src} 
                                  alt={`缩略图 ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="truncate">{image.name || `图片 ${index + 1}`}</span>
                            </div>
                            <button 
                              className="ml-2 text-red-500 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageIndex(index);
                                removeSelectedImage();
                              }}
                            >
                              移除
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                
                <div className="border p-2 rounded-md h-60 overflow-y-auto">
                  <h3 className="font-medium mb-2">隐藏图片:</h3>
                  {images.filter(img => !img.visible).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无隐藏图片</p>
                  ) : (
                    <ul className="space-y-2">
                      {images.map((image, index) => {
                        if (image.visible) return null;
                        return (
                          <li 
                            key={index}
                            className="px-3 py-2 cursor-pointer rounded flex items-center justify-between hover:bg-gray-100"
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="w-8 h-8 bg-gray-200 flex-shrink-0 mr-2 overflow-hidden opacity-50">
                                <img 
                                  src={image.img.src} 
                                  alt={`缩略图 ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="truncate text-gray-500">{image.name || `图片 ${index + 1}`}</span>
                            </div>
                            <div className="flex space-x-2">
                              <button 
                                className="text-green-500 hover:text-green-700"
                                onClick={() => showImage(index)}
                              >
                                显示
                              </button>
                              <button 
                                className="text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setSelectedImageIndex(index);
                                  deleteSelectedImage();
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
              
              {/* 图片控制 */}
              {selectedImageIndex !== -1 && (
                <div className="space-y-4 border p-4 rounded-md">
                  <h3 className="font-medium">图片控制:</h3>
                  
                  <div className="space-y-2">
                    <label className="block text-sm">
                      缩放: {images[selectedImageIndex].scale.toFixed(2)}x
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.05"
                      value={images[selectedImageIndex].scale}
                      onChange={handleScaleChange}
                      className="w-full"
                    />
                  </div>
                  
                  <button
                    onClick={removeSelectedImage}
                    className="w-full bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600"
                  >
                    从画布移除
                  </button>
                </div>
              )}
            </div>
            
            {/* 中间：画布区域 */}
            <div className="lg:col-span-2 space-y-4">
              <div 
                ref={canvasContainerRef}
                className="overflow-hidden bg-gray-50 flex justify-center relative"
              >
                <canvas
                  ref={canvasRef}
                  className="max-w-full h-auto cursor-move"
                  style={{
                    aspectRatio: '1051/1500',
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
                {selectedImageIndex !== -1 && (
                  <div className="absolute top-2 left-2 bg-white bg-opacity-80 rounded px-2 py-1 text-sm">
                    已选择: {images[selectedImageIndex].name || `图片 ${selectedImageIndex + 1}`}
                  </div>
                )}
              </div>
              
              {/* 网格控制 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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
                
                <div>
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
              
              {/* 线稿控制 */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input 
                    type="checkbox"
                    id="sketch-mode"
                    checked={isSketch}
                    onChange={(e) => {
                      setIsSketch(e.target.checked);
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="sketch-mode" className="ml-2 text-sm font-medium text-gray-700">
                    显示线稿
                  </label>
                </div>
                
                {isSketch && (
                  <div>
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
                      }}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              
              <button
                onClick={downloadImage}
                className="w-full bg-purple-500 text-white px-4 py-3 rounded-md hover:bg-purple-600"
              >
                下载带网格的图片
              </button>
              
              {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                <p className="text-sm text-gray-600 text-center">
                  iOS设备请在新窗口打开后，长按图片选择"存储图像"
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}