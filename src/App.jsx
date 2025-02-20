import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from './lib/utils';

export default function App() {
  // 状态定义
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [gridColor, setGridColor] = useState('#ff0000');
  const [gridOpacity, setGridOpacity] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeMode, setResizeMode] = useState('none'); // 'none', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'
  const [initialScale, setInitialScale] = useState(1);
  const [initialDimensions, setInitialDimensions] = useState({ width: 0, height: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState(0);

  // 新增UI控制状态
  const [showGridSettings, setShowGridSettings] = useState(false);

  // refs
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasContainerRef = useRef(null);

  // 生成线稿图片
  const generateSketch = useCallback(() => {
    try {
      // 确保已选择图片
      console.log("Selected index:", selectedImageIndex);
      if (selectedImageIndex === -1 || !images[selectedImageIndex]) {
        console.log("No image selected");
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        console.log("Canvas not found");
        return;
      }

      const selectedImage = images[selectedImageIndex];
      const img = selectedImage.img;

      // 创建一个临时画布来生成线稿
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      // 设置临时画布大小为原图大小
      const originalWidth = img.width;
      const originalHeight = img.height;
      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;

      // 绘制原图到临时画布
      tempCtx.drawImage(img, 0, 0, originalWidth, originalHeight);

      // 应用线稿效果
      const imageData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
      const data = imageData.data;

      // 创建临时数组存储灰度值
      const grayData = new Array(originalWidth * originalHeight);

      // 转换为灰度并存储
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        grayData[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      // 应用高斯模糊以减少噪点
      const gaussianBlur = (x, y) => {
        let sum = 0;
        let count = 0;
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const px = x + i;
            const py = y + j;
            if (px >= 0 && px < originalWidth && py >= 0 && py < originalHeight) {
              sum += grayData[py * originalWidth + px];
              count++;
            }
          }
        }
        return Math.round(sum / count);
      };

      // 应用Sobel算子检测边缘
      for (let y = 1; y < originalHeight - 1; y++) {
        for (let x = 1; x < originalWidth - 1; x++) {
          const idx = (y * originalWidth + x) * 4;

          // 计算周围像素的梯度
          const gx =
            -1 * gaussianBlur(x - 1, y - 1) +
            -2 * gaussianBlur(x - 1, y) +
            -1 * gaussianBlur(x - 1, y + 1) +
            1 * gaussianBlur(x + 1, y - 1) +
            2 * gaussianBlur(x + 1, y) +
            1 * gaussianBlur(x + 1, y + 1);

          const gy =
            -1 * gaussianBlur(x - 1, y - 1) +
            -2 * gaussianBlur(x, y - 1) +
            -1 * gaussianBlur(x + 1, y - 1) +
            1 * gaussianBlur(x - 1, y + 1) +
            2 * gaussianBlur(x, y + 1) +
            1 * gaussianBlur(x + 1, y + 1);

          // 使用固定的中等深浅度
          const darkness = 0.5;
          const grad = Math.sqrt(gx * gx + gy * gy);
          const intensity = Math.min(255, Math.pow(grad / 1.5, 0.6) * (2.0 + darkness * 2));
          const value = Math.max(0, 255 - intensity * (1.5 + darkness));
          const finalValue = value < 180 ? value * (0.5 - darkness * 0.3) : value;

          // 设置为白底黑线
          data[idx] = data[idx + 1] = data[idx + 2] = finalValue;
          data[idx + 3] = 255; // 完全不透明
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      // 创建新图片对象
      const sketchImage = new Image();
      sketchImage.onload = () => {
        // 计算新位置（居中）
        const GRID_SIZE = 32;
        const newScale = selectedImage.scale;
        const newWidth = sketchImage.width * newScale;
        const newHeight = sketchImage.height * newScale;

        // 居中定位，对齐到网格
        let centerX = (canvas.width - newWidth) / 2;
        let centerY = (canvas.height - newHeight) / 2;

        centerX = Math.round(centerX / GRID_SIZE) * GRID_SIZE;
        centerY = Math.round(centerY / GRID_SIZE) * GRID_SIZE;

        // 添加新图片到顶层
        setImages(prevImages => [
          {
            img: sketchImage,
            name: `${selectedImage.name || 'Image'} (线稿)`,
            scale: newScale,
            x: centerX,
            y: centerY,
            width: sketchImage.width,
            height: sketchImage.height
          },
          ...prevImages
        ]);

        // 将选择切换到新图片
        setSelectedImageIndex(0);
        drawCanvas();
      };

      // 将临时画布内容转换为图片
      sketchImage.src = tempCanvas.toDataURL('image/png');
    } catch (error) {
      console.error('生成线稿时出错:', error);
    }
  }, [images, selectedImageIndex]);

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

      // 如果是选中的图片，绘制边框和调整大小的控制点
      if (index === selectedImageIndex) {
        // 绘制选中边框
        ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(image.x, image.y, scaledWidth, scaledHeight);
        ctx.setLineDash([]);

        // 绘制四个角的控制点
        const controlSize = 10;
        ctx.fillStyle = 'rgba(0, 120, 255, 0.8)';

        // 左上角
        ctx.fillRect(image.x - controlSize / 2, image.y - controlSize / 2, controlSize, controlSize);
        // 右上角
        ctx.fillRect(image.x + scaledWidth - controlSize / 2, image.y - controlSize / 2, controlSize, controlSize);
        // 左下角
        ctx.fillRect(image.x - controlSize / 2, image.y + scaledHeight - controlSize / 2, controlSize, controlSize);
        // 右下角
        ctx.fillRect(image.x + scaledWidth - controlSize / 2, image.y + scaledHeight - controlSize / 2, controlSize, controlSize);
      }
    });

    // 绘制网格
    drawGrid(ctx, canvas.width, canvas.height, gridColor, gridOpacity);
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

  // 检查点击位置是否在图片上或控制点上
  const getImageAtPosition = (x, y) => {
    // 从前往后检查，因为前面的图片在上层
    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      const scaledWidth = image.img.width * image.scale;
      const scaledHeight = image.img.height * image.scale;

      // 如果当前图片是选中的，检查是否点击在控制点上
      if (i === selectedImageIndex) {
        const controlSize = 10;

        // 检查左上角控制点
        if (
          x >= image.x - controlSize / 2 &&
          x <= image.x + controlSize / 2 &&
          y >= image.y - controlSize / 2 &&
          y <= image.y + controlSize / 2
        ) {
          return { index: i, resizePoint: 'topLeft' };
        }

        // 检查右上角控制点
        if (
          x >= image.x + scaledWidth - controlSize / 2 &&
          x <= image.x + scaledWidth + controlSize / 2 &&
          y >= image.y - controlSize / 2 &&
          y <= image.y + controlSize / 2
        ) {
          return { index: i, resizePoint: 'topRight' };
        }

        // 检查左下角控制点
        if (
          x >= image.x - controlSize / 2 &&
          x <= image.x + controlSize / 2 &&
          y >= image.y + scaledHeight - controlSize / 2 &&
          y <= image.y + scaledHeight + controlSize / 2
        ) {
          return { index: i, resizePoint: 'bottomLeft' };
        }

        // 检查右下角控制点
        if (
          x >= image.x + scaledWidth - controlSize / 2 &&
          x <= image.x + scaledWidth + controlSize / 2 &&
          y >= image.y + scaledHeight - controlSize / 2 &&
          y <= image.y + scaledHeight + controlSize / 2
        ) {
          return { index: i, resizePoint: 'bottomRight' };
        }
      }

      // 检查图片本身
      if (
        x >= image.x &&
        x <= image.x + scaledWidth &&
        y >= image.y &&
        y <= image.y + scaledHeight
      ) {
        return { index: i, resizePoint: 'none' };
      }
    }
    return { index: -1, resizePoint: 'none' };
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

    const result = getImageAtPosition(x, y);

    if (result.index !== -1) {
      setSelectedImageIndex(result.index);

      if (result.resizePoint !== 'none') {
        // 开始调整大小
        setResizeMode(result.resizePoint);
        const image = images[result.index];
        setInitialScale(image.scale);
        setInitialDimensions({
          width: image.img.width * image.scale,
          height: image.img.height * image.scale,
          x: image.x,
          y: image.y
        });
      } else {
        // 开始拖动
        setIsDragging(true);
        setResizeMode('none');
      }

      setDragStart({ x, y });
    } else {
      setSelectedImageIndex(-1);
      setResizeMode('none');
    }

    drawCanvas();
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || selectedImageIndex === -1) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (resizeMode !== 'none') {
      // 处理调整大小
      handleResize(x, y);
    } else if (isDragging) {
      // 处理拖动
      handleDrag(x, y);
    }
  };

  const handleDrag = (x, y) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // 计算移动了多少个网格单位
    const GRID_SIZE = 32; // 网格大小，与drawGrid保持一致
    const totalDx = x - dragStart.x;
    const totalDy = y - dragStart.y;

    // 计算网格单位移动量（四舍五入到最近的网格单位）
    const gridDx = Math.round(totalDx / GRID_SIZE) * GRID_SIZE;
    const gridDy = Math.round(totalDy / GRID_SIZE) * GRID_SIZE;

    // 只有当移动量达到一个完整网格大小时才更新位置
    if (gridDx !== 0 || gridDy !== 0) {
      setImages(prevImages => {
        const newImages = [...prevImages];
        const currentImage = newImages[selectedImageIndex];
        const scaledWidth = currentImage.img.width * currentImage.scale;
        const scaledHeight = currentImage.img.height * currentImage.scale;

        // 计算新位置（始终对齐到网格）
        let newX = currentImage.x + gridDx;
        let newY = currentImage.y + gridDy;

        // 限制图片不要超出画布边界，并对齐到网格
        newX = Math.max(0, Math.min(canvas.width - scaledWidth, newX));
        newY = Math.max(0, Math.min(canvas.height - scaledHeight, newY));

        // 将位置对齐到网格
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

        newImages[selectedImageIndex] = {
          ...currentImage,
          x: newX,
          y: newY
        };

        return newImages;
      });

      // 更新拖拽起始点
      setDragStart({
        x: dragStart.x + gridDx,
        y: dragStart.y + gridDy
      });

      drawCanvas();
    }
  };

  const handleResize = (x, y) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const GRID_SIZE = 32;
    const image = images[selectedImageIndex];
    const originalWidth = image.img.width;
    const originalHeight = image.img.height;
    const { x: startX, y: startY } = initialDimensions;

    let newScale = image.scale;
    let newX = image.x;
    let newY = image.y;

    // 根据拖动的角计算新的缩放比例
    switch (resizeMode) {
      case 'topLeft':
        {
          // 计算新宽度和高度 (拖得越左/上图片越大)
          const widthChange = dragStart.x - x;
          const heightChange = dragStart.y - y;

          // 计算缩放比例变化（基于最大变化维度，保持纵横比）
          const scaleFactor = Math.max(
            1 + widthChange / initialDimensions.width,
            1 + heightChange / initialDimensions.height
          );

          newScale = initialScale * scaleFactor;

          // 更新位置以保持右下角固定
          const newWidth = originalWidth * newScale;
          const newHeight = originalHeight * newScale;
          newX = startX + initialDimensions.width - newWidth;
          newY = startY + initialDimensions.height - newHeight;
        }
        break;

      case 'topRight':
        {
          // 计算新宽度和高度
          const widthChange = x - dragStart.x;
          const heightChange = dragStart.y - y;

          // 计算缩放比例变化
          const scaleFactor = Math.max(
            1 + widthChange / initialDimensions.width,
            1 + heightChange / initialDimensions.height
          );

          newScale = initialScale * scaleFactor;

          // 更新位置以保持左下角固定
          const newHeight = originalHeight * newScale;
          newY = startY + initialDimensions.height - newHeight;
        }
        break;

      case 'bottomLeft':
        {
          // 计算新宽度和高度
          const widthChange = dragStart.x - x;
          const heightChange = y - dragStart.y;

          // 计算缩放比例变化
          const scaleFactor = Math.max(
            1 + widthChange / initialDimensions.width,
            1 + heightChange / initialDimensions.height
          );

          newScale = initialScale * scaleFactor;

          // 更新位置以保持右上角固定
          const newWidth = originalWidth * newScale;
          newX = startX + initialDimensions.width - newWidth;
        }
        break;

      case 'bottomRight':
        {
          // 计算新宽度和高度
          const widthChange = x - dragStart.x;
          const heightChange = y - dragStart.y;

          // 计算缩放比例变化
          const scaleFactor = Math.max(
            1 + widthChange / initialDimensions.width,
            1 + heightChange / initialDimensions.height
          );

          newScale = initialScale * scaleFactor;
          // 位置不变，只有尺寸变化
        }
        break;
    }

    // 限制缩放范围
    newScale = Math.max(0.1, Math.min(newScale, 5));

    // 对齐到网格
    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

    // 确保不超出画布边界
    newX = Math.max(0, Math.min(canvas.width - originalWidth * newScale, newX));
    newY = Math.max(0, Math.min(canvas.height - originalHeight * newScale, newY));

    // 更新图片
    setImages(prevImages => {
      const newImages = [...prevImages];
      newImages[selectedImageIndex] = {
        ...newImages[selectedImageIndex],
        scale: newScale,
        x: newX,
        y: newY
      };
      return newImages;
    });

    drawCanvas();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizeMode('none');
  };

  // 触摸事件处理
  const handleTouchStart = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // 检查触摸是否在画布区域内
    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    // 如果触摸点在画布区域内，才阻止默认行为
    if (
      touchX >= rect.left &&
      touchX <= rect.right &&
      touchY >= rect.top &&
      touchY <= rect.bottom
    ) {
      e.preventDefault();

      if (e.touches.length === 1) {
        // 单指触摸 - 处理拖动或调整大小
        handleMouseDown({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      } else if (e.touches.length === 2 && selectedImageIndex !== -1) {
        // 双指触摸 - 处理缩放
        setIsPinching(true);
        setIsDragging(false);
        setResizeMode('none');

        // 计算两指之间的距离
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        setLastPinchDistance(distance);

        // 保存初始缩放和尺寸
        const image = images[selectedImageIndex];
        setInitialScale(image.scale);
        setInitialDimensions({
          width: image.img.width * image.scale,
          height: image.img.height * image.scale,
          x: image.x,
          y: image.y
        });
      }
    }
    // 如果不在画布区域内，不阻止默认行为，允许页面滚动
  };

  // 修改后的触摸移动处理函数 - 修复iOS缩放问题
  const handleTouchMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 只有在拖动、调整大小或捏合缩放时才阻止默认行为
    if (isDragging || resizeMode !== 'none' || isPinching) {
      e.preventDefault();

      if (e.touches.length === 1 && !isPinching) {
        // 单指移动
        const touch = e.touches[0];
        handleMouseMove({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      } else if (e.touches.length === 2 && isPinching && selectedImageIndex !== -1) {
        // 双指缩放 - 修复iOS上的问题
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const image = images[selectedImageIndex];
        const GRID_SIZE = 32;

        // 计算新的两指距离
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch2.clientY
        );

        // 仅当有明显变化时才处理，避免抖动
        if (Math.abs(distance - lastPinchDistance) > 5) {
          // 计算缩放比例
          const scaleFactor = distance / lastPinchDistance;
          let newScale = initialScale * scaleFactor;

          // 限制缩放范围
          newScale = Math.max(0.1, Math.min(newScale, 5));

          // 计算触摸中心点 - 转换为画布坐标系
          const centerClientX = (touch1.clientX + touch2.clientX) / 2;
          const centerClientY = (touch1.clientY + touch2.clientY) / 2;

          // 转换为画布坐标系
          const centerCanvasX = (centerClientX - rect.left) * scaleX;
          const centerCanvasY = (centerClientY - rect.top) * scaleY;

          // 计算当前图片中心点
          const imgCenterX = image.x + (image.img.width * image.scale) / 2;
          const imgCenterY = image.y + (image.img.height * image.scale) / 2;

          // 计算缩放后的新尺寸
          const newWidth = image.img.width * newScale;
          const newHeight = image.img.height * newScale;

          // 计算新的左上角位置，保持缩放中心点不变
          let newX = imgCenterX - newWidth / 2;
          let newY = imgCenterY - newHeight / 2;

          // 对齐到网格
          newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
          newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

          // 确保不超出画布边界
          newX = Math.max(0, Math.min(canvas.width - newWidth, newX));
          newY = Math.max(0, Math.min(canvas.height - newHeight, newY));

          // 更新图片
          setImages(prevImages => {
            const newImages = [...prevImages];
            newImages[selectedImageIndex] = {
              ...newImages[selectedImageIndex],
              scale: newScale,
              x: newX,
              y: newY
            };
            return newImages;
          });

          setLastPinchDistance(distance);
          drawCanvas();
        }
      }
    }
    // 如果不是在操作画布，不阻止默认行为，允许页面滚动
  };

  const handleTouchEnd = (e) => {
    // 不需要在这里调用 preventDefault
    if (e.touches.length === 0) {
      // 所有手指都离开了屏幕
      setIsPinching(false);
      setIsDragging(false);
      setResizeMode('none');
    } else if (e.touches.length === 1 && isPinching) {
      // 从双指到单指，重新设置拖动起点
      setIsPinching(false);
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        setDragStart({
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY
        });
      }
    }
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

  // 网格设置对话框组件
  const GridSettingsDialog = () => {
    if (!showGridSettings) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
        <div className="bg-white rounded-lg p-6 w-11/12 max-w-md">
          <h3 className="text-xl font-bold mb-4">网格设置</h3>

          <div className="space-y-4">
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

          <div className="mt-6 flex justify-end space-x-2">
            <button
              onClick={() => setShowGridSettings(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 当组件挂载时，设置事件监听器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
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
  }, [selectedImageIndex, isDragging, dragStart, images, resizeMode, isPinching, lastPinchDistance, initialScale, initialDimensions]);

  // 当任何相关状态变化时，重绘画布
  useEffect(() => {
    drawCanvas();
  }, [selectedImageIndex, gridColor, gridOpacity]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">图片网格工具</h1>

          {/* 工具栏 */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => fileInputRef.current.click()}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
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

            <button
              onClick={() => setShowGridSettings(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              网格设置
            </button>

            <button
              onClick={downloadImage}
              className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
            >
              下载图片
            </button>
          </div>

          {/* 画布区域 */}
          <div
            ref={canvasContainerRef}
            className="overflow-hidden bg-gray-50 flex justify-center relative border rounded-md mb-4"
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
                已选择: {images[selectedImageIndex]?.name || `图片 ${selectedImageIndex + 1}`}
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

          {/* 图片控制区域 - 现在放在画布和图片列表之间 */}
          <div className="mb-4">
            <div className="border p-4 rounded-md bg-gray-50">
              <h3 className="font-medium mb-3">图片控制:</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <button
                  onClick={bringToFront}
                  disabled={selectedImageIndex === -1 || selectedImageIndex === 0}
                  className={`px-3 py-2 rounded-md ${selectedImageIndex !== -1 && selectedImageIndex !== 0
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  移至顶层
                </button>

                <button
                  onClick={sendToBack}
                  disabled={selectedImageIndex === -1 || selectedImageIndex === images.length - 1}
                  className={`px-3 py-2 rounded-md ${selectedImageIndex !== -1 && selectedImageIndex !== images.length - 1
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  移至底层
                </button>

                <button
                  onClick={generateSketch}
                  disabled={selectedImageIndex === -1}
                  className={`px-3 py-2 rounded-md ${selectedImageIndex !== -1
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  生成线稿副本
                </button>

                <button
                  onClick={deleteSelectedImage}
                  disabled={selectedImageIndex === -1}
                  className={`px-3 py-2 rounded-md ${selectedImageIndex !== -1
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  删除图片
                </button>
              </div>

              {selectedImageIndex !== -1 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">
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
              )}
            </div>
          </div>

          {/* 图片列表 */}
          {images.length > 0 && (
            <div className="border rounded-md p-4 bg-gray-50">
              <h3 className="font-medium mb-2">图片列表 ({images.length}张):</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
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

      {/* 网格设置对话框 */}
      <GridSettingsDialog />
    </div>
  );
}