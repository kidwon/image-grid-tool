import React, { useState, useRef, useEffect } from 'react';
import { cn } from './lib/utils';

export default function App() {
  // 状态定义
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [gridColor, setGridColor] = useState('#ff0000');
  const [gridOpacity, setGridOpacity] = useState(0.8);
  const [isSketch, setIsSketch] = useState(false);
  const [sketchDarkness, setSketchDarkness] = useState(0.5);
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
              // 获取画布尺寸
              const canvas = canvasRef.current;
              const GRID_SIZE = 32;
              
              // 根据网格计算初始位置（吸附到网格）
              // 为了避免图片堆叠，计算一个基于当前图片数量的偏移
              const offsetMultiplier = images.length % 10; // 每10张图片循环一次偏移
              const offsetX = offsetMultiplier * GRID_SIZE;
              const offsetY = Math.floor(images.length / 10) * GRID_SIZE;
              
              // 确保图片在画布范围内
              const initialScale = 0.5; // 初始缩放比例
              const scaledWidth = img.width * initialScale;
              const scaledHeight = img.height * initialScale;
              
              // 将位置吸附到网格
              const x = Math.min(offsetX, canvas ? canvas.width - scaledWidth : 1000);
              const y = Math.min(offsetY, canvas ? canvas.height - scaledHeight : 1000);
              
              newImages.push({
                img: img,
                name: file.name,
                scale: initialScale,
                x: Math.round(x / GRID_SIZE) * GRID_SIZE, // 吸附到网格
                y: Math.round(y / GRID_SIZE) * GRID_SIZE, // 吸附到网格
                width: img.width,
                height: img.height
              });
              
              loadedCount++;
              if (loadedCount === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
                // 将新图片添加到顶层（数组前面）
                setImages(prevImages => [...newImages, ...prevImages]);
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
    
    // 绘制所有图片
    images.forEach((image, index) => {
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
    
    // 使用固定大小的网格 (32x32) - 注意：如果修改这个值，也需要修改handleMouseMove中的GRID_SIZE
    const GRID_SIZE = 32;
    
    // 从0开始绘制网格，确保左上角也有网格线
    // 绘制垂直线
    for (let x = 0; x <= width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = 0; y <= height; y += GRID_SIZE) {
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
    // 从前往后检查，因为前面的图片在上层
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
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
      const currentImage = newImages[selectedImageIndex];
      const scaledWidth = currentImage.img.width * currentImage.scale;
      const scaledHeight = currentImage.img.height * currentImage.scale;
      
      // 计算新位置
      let newX = currentImage.x + dx;
      let newY = currentImage.y + dy;
      
      // 限制图片不要超出画布边界
      newX = Math.max(0, Math.min(canvas.width - scaledWidth, newX));
      newY = Math.max(0, Math.min(canvas.height - scaledHeight, newY));
      
      newImages[selectedImageIndex] = {
        ...currentImage,
        x: newX,
        y: newY
      };
      
      return newImages;
    });
    
    setDragStart({ x, y });
    drawCanvas();
  };

  const handleMouseUp = () => {
    // 停止拖动时进行网格吸附
    if (isDragging && selectedImageIndex !== -1) {
      setImages(prevImages => {
        const newImages = [...prevImages];
        const currentImage = newImages[selectedImageIndex];
        
        // 网格吸附逻辑
        const GRID_SIZE = 32;
        
        // 吸附到网格左上角
        const snappedX = Math.round(currentImage.x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.round(currentImage.y / GRID_SIZE) * GRID_SIZE;
        
        newImages[selectedImageIndex] = {
          ...currentImage,
          x: snappedX,
          y: snappedY
        };
        
        return newImages;
      });
      
      // 重绘画布以显示吸附后的位置
      drawCanvas();
    }
    
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

  // 将选中的图片移到顶层
  const bringToFront = () => {
    if (selectedImageIndex === -1 || selectedImageIndex === 0) return;
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      const selected = newImages.splice(selectedImageIndex, 1)[0];
      return [selected, ...newImages];
    });
    
    setSelectedImageIndex(0);
    drawCanvas();
  };

  // 将选中的图片移到底层
  const sendToBack = () => {
    if (selectedImageIndex === -1 || selectedImageIndex === images.length - 1) return;
    
    setImages(prevImages => {
      const newImages = [...prevImages];
      const selected = newImages.splice(selectedImageIndex, 1)[0];
      return [...newImages, selected];
    });
    
    setSelectedImageIndex(images.length - 1);
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
            {/* 左侧：工具控制面板 */}
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
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={bringToFront}
                      className="bg-blue-500 text-white px-2 py-1 rounded-md hover:bg-blue-600"
                    >
                      移至顶层
                    </button>
                    <button
                      onClick={sendToBack}
                      className="bg-blue-500 text-white px-2 py-1 rounded-md hover:bg-blue-600"
                    >
                      移至底层
                    </button>
                  </div>
                  
                  <button
                    onClick={deleteSelectedImage}
                    className="w-full bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600"
                  >
                    删除图片
                  </button>
                </div>
              )}
              
              {/* 网格控制 */}
              <div className="space-y-4 border p-4 rounded-md">
                <h3 className="font-medium">网格设置:</h3>
                
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
              <div className="space-y-4 border p-4 rounded-md">
                <h3 className="font-medium">线稿效果:</h3>
                
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
            
            {/* 右侧：画布区域 */}
            <div className="lg:col-span-2 space-y-4">
              <div 
                ref={canvasContainerRef}
                className="overflow-hidden bg-gray-50 flex justify-center relative border rounded-md"
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
                {images.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p>点击"选择图片"按钮上传图片</p>
                      <p className="text-sm mt-2">支持拖拽位置和调整大小</p>
                    </div>
                  </div>
                )}
              </div>
              
              {images.length > 0 && (
                <div className="border rounded-md p-4 bg-gray-50">
                  <h3 className="font-medium mb-2">图片列表 ({images.length}张):</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {images.map((image, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "cursor-pointer rounded-md p-1 overflow-hidden border",
                          selectedImageIndex === index 
                            ? "border-blue-500 bg-blue-50" 
                            : "border-gray-200 hover:bg-gray-100"
                        )}
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <div className="relative pb-[75%]">
                          <img 
                            src={image.img.src} 
                            alt={`图片 ${index + 1}`}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        </div>
                        <div className="mt-1 truncate text-xs text-center">
                          {image.name || `图片 ${index + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}