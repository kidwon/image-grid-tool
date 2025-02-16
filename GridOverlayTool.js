import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

const GridOverlayTool = () => {
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
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="rows" className="block mb-2">行数</Label>
                <Input
                  id="rows"
                  type="number"
                  value={rows}
                  onChange={handleRowsChange}
                  min="1"
                  max="20"
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="cols" className="block mb-2">列数</Label>
                <Input
                  id="cols"
                  type="number"
                  value={cols}
                  onChange={handleColsChange}
                  min="1"
                  max="20"
                  className="w-full"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-4">
              <Button onClick={() => presetGrid(3, 3)} className="flex-1">
                九宫格 (3×3)
              </Button>
              <Button onClick={() => presetGrid(4, 6)} className="flex-1">
                24宫格 (4×6)
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => fileInputRef.current.click()}
              className="w-full"
            >
              选择图片
            </Button>
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
            <Button onClick={downloadImage} className="w-full">
              下载带网格的图片
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GridOverlayTool;