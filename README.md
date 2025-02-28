# Image Grid Tool

A web application for artists and designers to work with reference images using customizable grid overlays.

**Live Demo**: [https://kidwon.github.io/image-grid-tool/](https://kidwon.github.io/image-grid-tool/)

## Features

- **Multiple Grid System**: 
  - Small 32×32 pixel grid for precise placement
  - Large 128×192 pixel grid for composition and proportions
  - Customizable grid color and opacity

- **Image Management**:
  - Upload and manage multiple images
  - Drag, resize, and organize images to create composition layouts
  - Move images to front or back to control layering
  - Generate line art versions of images

- **Easy Editing**:
  - Snap to grid for precise alignment
  - Interactive resize handles
  - Touch support for mobile devices
  - Scale control slider

- **Export**:
  - Download your compositions with grid overlay
  - Special handling for iOS devices

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/image-grid-tool.git

# Navigate to the project directory
cd image-grid-tool

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Usage

1. Click "选择图片" (Choose Image) to upload one or more images
2. Drag images to position them on the canvas
3. Use the corner handles to resize images
4. Adjust the grid settings with the "网格设置" (Grid Settings) button
5. Download your composed image with the "下载图片" (Download Image) button

## Deployment

The application is configured for GitHub Pages deployment. Push to the main branch to trigger automatic deployment.

```bash
# Build for production
npm run build

# Deploy manually (if needed)
npm run deploy
```

## Technical Details

- Built with React and Vite
- Styled with Tailwind CSS
- Uses HTML5 Canvas for rendering
- Responsive design for desktop and mobile devices

## License

[MIT License](LICENSE)

## Acknowledgements

- This tool was created for artists who need a grid system for accurate drawing and composition
- Special thanks to the React and Tailwind CSS communities for their excellent documentation
