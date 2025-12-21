// Global State
const state = {
    images: [],
    currentImage: null,
    originalImage: null,
    processedImages: [],
    aspectRatioLocked: true,
    originalAspectRatio: 1,
    filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0
    }
};

// DOM Elements
const elements = {
    uploadZone: document.getElementById('uploadZone'),
    imageInput: document.getElementById('imageInput'),
    uploadSection: document.getElementById('uploadSection'),
    processingArea: document.getElementById('processingArea'),
    preview: document.getElementById('preview'),
    canvas: document.getElementById('canvas'),
    originalPreview: document.getElementById('originalPreview'),
    processedPreview: document.getElementById('processedPreview'),
    comparisonView: document.getElementById('comparisonView'),
    singleView: document.getElementById('singleView'),
    imageMetadata: document.getElementById('imageMetadata'),
    originalInfo: document.getElementById('originalInfo'),
    processedInfo: document.getElementById('processedInfo'),
    batchGallery: document.getElementById('batchGallery'),
    batchCount: document.getElementById('batchCount'),
    downloadSection: document.getElementById('downloadSection'),
    downloadBtn: document.getElementById('downloadBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeTabs();
    initializeControls();
});

// Event Listeners
function initializeEventListeners() {
    // Upload
    elements.imageInput.addEventListener('change', handleFileSelect);
    elements.uploadZone.addEventListener('click', () => elements.imageInput.click());

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    // Buttons
    document.getElementById('applyResize')?.addEventListener('click', applyResize);
    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('applyCrop')?.addEventListener('click', applyCrop);
    document.getElementById('processBatch')?.addEventListener('click', processBatch);
    document.getElementById('compareBtn')?.addEventListener('click', toggleComparison);
    document.getElementById('resetBtn')?.addEventListener('click', resetImage);
    document.getElementById('lockAspect')?.addEventListener('click', toggleAspectLock);
    elements.downloadBtn?.addEventListener('click', downloadImage);
    elements.downloadAllBtn?.addEventListener('click', downloadAllAsZip);

    // Preset buttons
    document.querySelectorAll('.preset-btn[data-width]').forEach(btn => {
        btn.addEventListener('click', () => applyPresetDimension(btn));
    });

    document.querySelectorAll('.preset-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => applyPresetFilter(btn.dataset.filter));
    });
}

// Tab System
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}Tab`);
    });
}

// Controls Initialization
function initializeControls() {
    // Resize mode toggle
    const resizeMode = document.getElementById('resizeMode');
    resizeMode?.addEventListener('change', toggleResizeMode);

    // Quality slider
    const quality = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    quality?.addEventListener('input', () => {
        qualityValue.textContent = quality.value;
    });

    // Download quality slider
    const downloadQuality = document.getElementById('downloadQuality');
    const downloadQualityValue = document.getElementById('downloadQualityValue');
    downloadQuality?.addEventListener('input', () => {
        downloadQualityValue.textContent = downloadQuality.value;
    });

    // Download format selector - show/hide quality based on format
    const downloadFormat = document.getElementById('downloadFormat');
    const downloadQualityGroup = document.getElementById('downloadQualityGroup');
    downloadFormat?.addEventListener('change', () => {
        // PNG is lossless, so hide quality slider
        if (downloadFormat.value === 'png') {
            downloadQualityGroup.style.display = 'none';
        } else {
            downloadQualityGroup.style.display = 'block';
        }
    });

    // Filter sliders
    const filterInputs = ['brightness', 'contrast', 'saturation', 'blur'];
    filterInputs.forEach(filter => {
        const input = document.getElementById(filter);
        const valueDisplay = document.getElementById(`${filter}Value`);
        input?.addEventListener('input', () => {
            valueDisplay.textContent = filter === 'blur' ? input.value : input.value;
            state.filters[filter] = parseInt(input.value);
            applyFiltersPreview();
        });
    });

    // Dimension inputs with aspect ratio lock
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');

    widthInput?.addEventListener('input', () => {
        if (state.aspectRatioLocked && state.originalAspectRatio) {
            heightInput.value = Math.round(widthInput.value / state.originalAspectRatio);
        }
    });

    heightInput?.addEventListener('input', () => {
        if (state.aspectRatioLocked && state.originalAspectRatio) {
            widthInput.value = Math.round(heightInput.value * state.originalAspectRatio);
        }
    });
}

// File Handling
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    processFiles(files);
}

function processFiles(files) {
    if (files.length === 0) return;

    state.images = files;
    elements.batchCount.textContent = files.length;

    if (files.length === 1) {
        loadSingleImage(files[0]);
    } else {
        loadMultipleImages(files);
    }

    showProcessingArea();
}

function loadSingleImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.currentImage = img;
            state.originalImage = img;
            state.originalAspectRatio = img.width / img.height;

            elements.preview.src = e.target.result;
            elements.originalPreview.src = e.target.result;

            // Set default dimensions
            document.getElementById('width').value = img.width;
            document.getElementById('height').value = img.height;

            updateMetadata(file, img);
            switchTab('resize');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function loadMultipleImages(files) {
    elements.batchGallery.innerHTML = '';

    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'batch-item';
            item.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <div class="batch-item-name">${file.name}</div>
                <button class="batch-item-remove" onclick="removeBatchItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            elements.batchGallery.appendChild(item);
        };
        reader.readAsDataURL(file);
    });

    // Load first image for preview
    loadSingleImage(files[0]);
    switchTab('batch');
}

function removeBatchItem(index) {
    state.images.splice(index, 1);
    elements.batchCount.textContent = state.images.length;

    if (state.images.length === 0) {
        resetToUpload();
    } else {
        loadMultipleImages(state.images);
    }
}

function showProcessingArea() {
    elements.uploadSection.style.display = 'none';
    elements.processingArea.style.display = 'block';
}

function resetToUpload() {
    elements.uploadSection.style.display = 'block';
    elements.processingArea.style.display = 'none';
    elements.downloadSection.style.display = 'none';
    state.images = [];
    state.currentImage = null;
    state.processedImages = [];
}

// Metadata
function updateMetadata(file, img) {
    const sizeKB = (file.size / 1024).toFixed(2);
    elements.imageMetadata.innerHTML = `
        <strong>File:</strong> ${file.name} &nbsp;|&nbsp;
        <strong>Size:</strong> ${sizeKB} KB &nbsp;|&nbsp;
        <strong>Dimensions:</strong> ${img.width} × ${img.height} px &nbsp;|&nbsp;
        <strong>Type:</strong> ${file.type}
    `;

    elements.originalInfo.textContent = `${img.width} × ${img.height} px • ${sizeKB} KB`;
}

// Resize Mode Toggle
function toggleResizeMode() {
    const mode = document.getElementById('resizeMode').value;
    const dimensionControls = document.getElementById('dimensionControls');
    const filesizeControls = document.getElementById('filesizeControls');

    if (mode === 'dimensions') {
        dimensionControls.style.display = 'block';
        filesizeControls.style.display = 'none';
    } else {
        dimensionControls.style.display = 'none';
        filesizeControls.style.display = 'block';
    }
}

// Aspect Ratio Lock
function toggleAspectLock() {
    state.aspectRatioLocked = !state.aspectRatioLocked;
    const lockBtn = document.getElementById('lockAspect');
    const icon = lockBtn.querySelector('i');

    if (state.aspectRatioLocked) {
        icon.className = 'fas fa-lock';
        lockBtn.classList.add('active');
    } else {
        icon.className = 'fas fa-unlock';
        lockBtn.classList.remove('active');
    }
}

// Preset Dimensions
function applyPresetDimension(btn) {
    const width = btn.dataset.width;
    const height = btn.dataset.height;

    document.getElementById('width').value = width;
    document.getElementById('height').value = height;
    document.getElementById('resizeMode').value = 'pixels';
    toggleResizeMode();
}

// Apply Resize
function applyResize() {
    if (!state.currentImage) return;

    const mode = document.getElementById('resizeMode').value;
    const format = document.getElementById('outputFormat').value;

    if (mode === 'filesize') {
        // Resize by target file size
        const targetSizeKB = parseInt(document.getElementById('targetFileSize').value);
        compressToFileSize(targetSizeKB, format);
    } else {
        // Resize by dimensions
        const quality = parseInt(document.getElementById('quality').value) / 100;
        const width = parseInt(document.getElementById('width').value);
        const height = parseInt(document.getElementById('height').value);

        const canvas = elements.canvas;
        const ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(state.currentImage, 0, 0, width, height);

        const mimeType = `image/${format}`;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        elements.preview.src = dataUrl;
        elements.processedPreview.src = dataUrl;

        // Update processed info
        const blob = dataURLtoBlob(dataUrl);
        const sizeKB = (blob.size / 1024).toFixed(2);
        elements.processedInfo.textContent = `${width} × ${height} px • ${sizeKB} KB`;

        showDownloadButton();
    }
}

// Compress image to target file size
function compressToFileSize(targetSizeKB, format) {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    const mimeType = `image/${format}`;

    // Start with original dimensions
    let width = state.currentImage.width;
    let height = state.currentImage.height;
    let quality = 0.9;
    let currentSizeKB = 0;
    let iterations = 0;
    const maxIterations = 20;

    // Binary search for optimal quality
    let minQuality = 0.1;
    let maxQuality = 1.0;

    while (iterations < maxIterations) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(state.currentImage, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);
        const blob = dataURLtoBlob(dataUrl);
        currentSizeKB = blob.size / 1024;

        // If we're within 5% of target, we're done
        if (Math.abs(currentSizeKB - targetSizeKB) / targetSizeKB < 0.05) {
            elements.preview.src = dataUrl;
            elements.processedPreview.src = dataUrl;
            elements.processedInfo.textContent = `${width} × ${height} px • ${currentSizeKB.toFixed(2)} KB`;
            showDownloadButton();
            return;
        }

        // Adjust quality using binary search
        if (currentSizeKB > targetSizeKB) {
            maxQuality = quality;
            quality = (minQuality + quality) / 2;
        } else {
            minQuality = quality;
            quality = (quality + maxQuality) / 2;
        }

        // If quality is too low and still too large, reduce dimensions
        if (quality < 0.15 && currentSizeKB > targetSizeKB) {
            const scaleFactor = Math.sqrt(targetSizeKB / currentSizeKB);
            width = Math.round(width * scaleFactor);
            height = Math.round(height * scaleFactor);
            quality = 0.8;
            minQuality = 0.1;
            maxQuality = 1.0;
        }

        iterations++;
    }

    // Final render
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(state.currentImage, 0, 0, width, height);
    const dataUrl = canvas.toDataURL(mimeType, quality);

    elements.preview.src = dataUrl;
    elements.processedPreview.src = dataUrl;

    const blob = dataURLtoBlob(dataUrl);
    currentSizeKB = (blob.size / 1024).toFixed(2);
    elements.processedInfo.textContent = `${width} × ${height} px • ${currentSizeKB} KB`;

    showDownloadButton();
}

// Filters
function applyFiltersPreview() {
    if (!state.currentImage) return;

    const filterString = `
        brightness(${state.filters.brightness}%)
        contrast(${state.filters.contrast}%)
        saturate(${state.filters.saturation}%)
        blur(${state.filters.blur}px)
    `;

    elements.preview.style.filter = filterString;
}

function applyFilters() {
    if (!state.currentImage) return;

    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    canvas.width = state.currentImage.width;
    canvas.height = state.height;

    // Apply CSS filters to canvas
    ctx.filter = `
        brightness(${state.filters.brightness}%)
        contrast(${state.filters.contrast}%)
        saturate(${state.filters.saturation}%)
        blur(${state.filters.blur}px)
    `;

    ctx.drawImage(state.currentImage, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');

    // Create new image from filtered canvas
    const img = new Image();
    img.onload = () => {
        state.currentImage = img;
        elements.preview.src = dataUrl;
        elements.preview.style.filter = 'none';
        showDownloadButton();
    };
    img.src = dataUrl;
}

function applyPresetFilter(filterName) {
    switch (filterName) {
        case 'grayscale':
            state.filters = { brightness: 100, contrast: 100, saturation: 0, blur: 0 };
            break;
        case 'sepia':
            state.filters = { brightness: 110, contrast: 90, saturation: 80, blur: 0 };
            break;
        case 'vintage':
            state.filters = { brightness: 110, contrast: 120, saturation: 70, blur: 0 };
            break;
        case 'vibrant':
            state.filters = { brightness: 105, contrast: 110, saturation: 150, blur: 0 };
            break;
        case 'reset':
            state.filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
            break;
    }

    // Update sliders
    document.getElementById('brightness').value = state.filters.brightness;
    document.getElementById('contrast').value = state.filters.contrast;
    document.getElementById('saturation').value = state.filters.saturation;
    document.getElementById('blur').value = state.filters.blur;

    document.getElementById('brightnessValue').textContent = state.filters.brightness;
    document.getElementById('contrastValue').textContent = state.filters.contrast;
    document.getElementById('saturationValue').textContent = state.filters.saturation;
    document.getElementById('blurValue').textContent = state.filters.blur;

    applyFiltersPreview();
}

// Crop (Basic implementation)
function applyCrop() {
    if (!state.currentImage) return;

    const ratio = document.getElementById('cropRatio').value;
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    let cropWidth = state.currentImage.width;
    let cropHeight = state.currentImage.height;

    if (ratio !== 'free') {
        const [w, h] = ratio.split(':').map(Number);
        const targetRatio = w / h;
        const currentRatio = cropWidth / cropHeight;

        if (currentRatio > targetRatio) {
            cropWidth = cropHeight * targetRatio;
        } else {
            cropHeight = cropWidth / targetRatio;
        }
    }

    const x = (state.currentImage.width - cropWidth) / 2;
    const y = (state.currentImage.height - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(state.currentImage, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
        state.currentImage = img;
        elements.preview.src = dataUrl;
        document.getElementById('width').value = cropWidth;
        document.getElementById('height').value = cropHeight;
        showDownloadButton();
    };
    img.src = dataUrl;
}

// Batch Processing
async function processBatch() {
    if (state.images.length === 0) return;

    elements.progressContainer.style.display = 'block';
    state.processedImages = [];

    const mode = document.getElementById('resizeMode').value;
    const quality = parseInt(document.getElementById('quality').value) / 100;
    const format = document.getElementById('outputFormat').value;

    for (let i = 0; i < state.images.length; i++) {
        const file = state.images[i];
        const processed = await processImageFile(file, mode, quality, format);
        state.processedImages.push({
            name: file.name.replace(/\.[^/.]+$/, `.${format}`),
            data: processed
        });

        const progress = ((i + 1) / state.images.length) * 100;
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `Processing: ${Math.round(progress)}%`;
    }

    elements.downloadAllBtn.style.display = 'inline-flex';
    showDownloadButton();
}

function processImageFile(file, mode, quality, format) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width, height;

                if (mode === 'percentage') {
                    const percentage = parseInt(document.getElementById('percentage').value) / 100;
                    width = Math.round(img.width * percentage);
                    height = Math.round(img.height * percentage);
                } else {
                    width = parseInt(document.getElementById('width').value);
                    height = parseInt(document.getElementById('height').value);
                }

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = `image/${format}`;
                const dataUrl = canvas.toDataURL(mimeType, quality);
                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Comparison View
function toggleComparison() {
    const isComparing = elements.comparisonView.style.display !== 'none';

    if (isComparing) {
        elements.comparisonView.style.display = 'none';
        elements.singleView.style.display = 'block';
        document.getElementById('compareBtn').classList.remove('active');
    } else {
        elements.comparisonView.style.display = 'grid';
        elements.singleView.style.display = 'none';
        document.getElementById('compareBtn').classList.add('active');
    }
}

// Reset
function resetImage() {
    if (!state.originalImage) return;

    state.currentImage = state.originalImage;
    elements.preview.src = state.originalImage.src;
    elements.preview.style.filter = 'none';

    // Reset filters
    state.filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
    document.getElementById('brightness').value = 100;
    document.getElementById('contrast').value = 100;
    document.getElementById('saturation').value = 100;
    document.getElementById('blur').value = 0;

    document.getElementById('brightnessValue').textContent = 100;
    document.getElementById('contrastValue').textContent = 100;
    document.getElementById('saturationValue').textContent = 100;
    document.getElementById('blurValue').textContent = 0;

    // Reset dimensions
    document.getElementById('width').value = state.originalImage.width;
    document.getElementById('height').value = state.originalImage.height;

    elements.downloadSection.style.display = 'none';
}

// Download
function showDownloadButton() {
    elements.downloadSection.style.display = 'flex';
}

function downloadImage() {
    // Get the current preview image
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    // Get download settings
    const format = document.getElementById('downloadFormat').value;
    const quality = parseInt(document.getElementById('downloadQuality').value) / 100;

    // If we have a processed image in the preview, use it
    const img = new Image();
    img.onload = () => {
        // Set canvas to image dimensions
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Convert to selected format
        const mimeType = format === 'jpeg' ? 'image/jpeg' :
            format === 'png' ? 'image/png' :
                'image/webp';

        // For PNG, quality doesn't apply (lossless), so we use 1.0
        const finalQuality = format === 'png' ? 1.0 : quality;

        // Convert canvas to blob
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('Error creating image file. Please try again.');
                return;
            }

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `processed-image.${format}`;
            link.href = url;
            link.click();

            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }, mimeType, finalQuality);
    };

    img.onerror = () => {
        alert('Error loading image. Please try processing the image again.');
    };

    // Load the current preview
    img.src = elements.preview.src;
}


async function downloadAllAsZip() {
    if (state.processedImages.length === 0) return;

    const zip = new JSZip();

    state.processedImages.forEach(img => {
        const base64Data = img.data.split(',')[1];
        zip.file(img.name, base64Data, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.download = 'processed-images.zip';
    link.href = URL.createObjectURL(blob);
    link.click();
}

// Utility Functions
function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}