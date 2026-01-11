/**
 * PicEdit - Client-side Image Processing
 * Features: Resize, Compress, Filters, Crop
 */

const PicEdit = {
    state: {
        currentImage: null,
        originalImage: null,
        originalFileSize: 0,
        aspectRatioLocked: true,
        originalAspectRatio: 1,
        compressedBlob: null,
        filters: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            blur: 0
        },
        crop: {
            isDragging: false,
            isResizing: false,
            resizeHandle: null,
            startX: 0,
            startY: 0,
            imageScale: 1,
            startRect: { x: 0, y: 0, width: 0, height: 0 }
        }
    },

    dom: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.ui.initTabs();
        this.ui.initControls();
        this.crop.init();
    },

    cacheDOM() {
        this.dom = {
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
            previewImageContainer: document.getElementById('previewImageContainer'),
            imageMetadata: document.getElementById('imageMetadata'),
            originalInfo: document.getElementById('originalInfo'),
            processedInfo: document.getElementById('processedInfo'),
            downloadSection: document.getElementById('downloadSection'),
            downloadBtn: document.getElementById('downloadBtn'),
            width: document.getElementById('width'),
            height: document.getElementById('height'),
            outputFormat: document.getElementById('outputFormat'),
            downloadFormat: document.getElementById('downloadFormat'),
            targetSize: document.getElementById('targetSize'),
            currentSizeDisplay: document.getElementById('currentSizeDisplay'),
            estimatedSizeDisplay: document.getElementById('estimatedSizeDisplay'),
            cropWidth: document.getElementById('cropWidth'),
            cropHeight: document.getElementById('cropHeight'),
            cropX: document.getElementById('cropX'),
            cropY: document.getElementById('cropY'),
            cropRatio: document.getElementById('cropRatio'),
            cropOriginalSize: document.getElementById('cropOriginalSize'),
            cropSelection: document.getElementById('cropSelection'),
            cropDimensions: document.getElementById('cropDimensions')
        };
    },

    bindEvents() {
        const d = this.dom;

        d.imageInput?.addEventListener('change', (e) => this.handlers.handleFileSelect(e));
        d.uploadZone?.addEventListener('click', () => d.imageInput.click());
        d.uploadZone?.addEventListener('dragover', (e) => { e.preventDefault(); d.uploadZone.classList.add('dragover'); });
        d.uploadZone?.addEventListener('dragleave', (e) => { e.preventDefault(); d.uploadZone.classList.remove('dragover'); });
        d.uploadZone?.addEventListener('drop', (e) => this.handlers.handleDrop(e));

        document.getElementById('applyResize')?.addEventListener('click', () => this.editor.applyResize());
        document.getElementById('applyCompress')?.addEventListener('click', () => this.editor.applyCompress());
        document.getElementById('applyFilters')?.addEventListener('click', () => this.editor.applyFilters());
        document.getElementById('applyCrop')?.addEventListener('click', () => this.editor.applyCrop());

        document.getElementById('compareBtn')?.addEventListener('click', () => this.ui.toggleComparison());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.editor.resetImage());
        document.getElementById('lockAspect')?.addEventListener('click', () => this.ui.toggleAspectLock());

        d.downloadBtn?.addEventListener('click', () => this.handlers.downloadImage());

        document.querySelectorAll('.preset-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => this.ui.applyPresetFilter(btn.dataset.filter));
        });

        d.targetSize?.addEventListener('input', () => this.ui.updateEstimatedSize());
        document.getElementById('cropRatio')?.addEventListener('change', (e) => this.ui.applyCropPreset(e.target.value));

        // Feature badge clicks in header
        document.querySelectorAll('.feature-badge[data-tab]').forEach(badge => {
            badge.addEventListener('click', () => {
                const tab = badge.dataset.tab;
                if (PicEdit.state.currentImage) {
                    this.ui.switchTab(tab);
                } else {
                    this.ui.showToast('Please upload an image first', 'info');
                }
            });
        });
    },

    // Crop Module
    crop: {
        init() {
            const selection = PicEdit.dom.cropSelection;
            if (!selection) return;

            // Handle resize from corners/edges
            document.querySelectorAll('.crop-handle').forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startResize(e, handle.dataset.handle);
                });
            });

            // Handle move (drag the selection)
            selection.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('crop-handle')) return;
                this.startDrag(e);
            });

            // Global mouse events
            document.addEventListener('mousemove', (e) => this.onMouseMove(e));
            document.addEventListener('mouseup', () => this.onMouseUp());
        },

        startResize(e, handle) {
            const sel = PicEdit.dom.cropSelection;
            const img = PicEdit.dom.preview;

            PicEdit.state.crop.isResizing = true;
            PicEdit.state.crop.resizeHandle = handle;
            PicEdit.state.crop.startX = e.clientX;
            PicEdit.state.crop.startY = e.clientY;
            PicEdit.state.crop.startRect = {
                x: parseInt(sel.style.left) || 0,
                y: parseInt(sel.style.top) || 0,
                width: parseInt(sel.style.width) || 100,
                height: parseInt(sel.style.height) || 100
            };
            PicEdit.state.crop.imageScale = PicEdit.state.currentImage.width / img.offsetWidth;
        },

        startDrag(e) {
            const sel = PicEdit.dom.cropSelection;
            const img = PicEdit.dom.preview;

            PicEdit.state.crop.isDragging = true;
            PicEdit.state.crop.startX = e.clientX;
            PicEdit.state.crop.startY = e.clientY;
            PicEdit.state.crop.startRect = {
                x: parseInt(sel.style.left) || 0,
                y: parseInt(sel.style.top) || 0,
                width: parseInt(sel.style.width) || 100,
                height: parseInt(sel.style.height) || 100
            };
            PicEdit.state.crop.imageScale = PicEdit.state.currentImage.width / img.offsetWidth;
        },

        onMouseMove(e) {
            const state = PicEdit.state.crop;
            if (!state.isDragging && !state.isResizing) return;

            const img = PicEdit.dom.preview;
            const sel = PicEdit.dom.cropSelection;
            const imgWidth = img.offsetWidth;
            const imgHeight = img.offsetHeight;

            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            const sr = state.startRect;

            let x = sr.x, y = sr.y, w = sr.width, h = sr.height;

            if (state.isDragging) {
                x = Math.max(0, Math.min(sr.x + dx, imgWidth - sr.width));
                y = Math.max(0, Math.min(sr.y + dy, imgHeight - sr.height));
            } else if (state.isResizing) {
                const handle = state.resizeHandle;

                if (handle.includes('e')) {
                    w = Math.max(20, Math.min(sr.width + dx, imgWidth - sr.x));
                }
                if (handle.includes('w')) {
                    const newX = sr.x + dx;
                    const newW = sr.width - dx;
                    if (newX >= 0 && newW >= 20) {
                        x = newX;
                        w = newW;
                    }
                }
                if (handle.includes('s')) {
                    h = Math.max(20, Math.min(sr.height + dy, imgHeight - sr.y));
                }
                if (handle.includes('n')) {
                    const newY = sr.y + dy;
                    const newH = sr.height - dy;
                    if (newY >= 0 && newH >= 20) {
                        y = newY;
                        h = newH;
                    }
                }
            }

            sel.style.left = x + 'px';
            sel.style.top = y + 'px';
            sel.style.width = w + 'px';
            sel.style.height = h + 'px';

            // Update input fields
            const scale = state.imageScale;
            if (PicEdit.dom.cropWidth) PicEdit.dom.cropWidth.value = Math.round(w * scale);
            if (PicEdit.dom.cropHeight) PicEdit.dom.cropHeight.value = Math.round(h * scale);
            if (PicEdit.dom.cropX) PicEdit.dom.cropX.value = Math.round(x * scale);
            if (PicEdit.dom.cropY) PicEdit.dom.cropY.value = Math.round(y * scale);

            // Update dimensions display
            if (PicEdit.dom.cropDimensions) {
                PicEdit.dom.cropDimensions.textContent = `${Math.round(w * scale)} × ${Math.round(h * scale)}`;
            }
        },

        onMouseUp() {
            PicEdit.state.crop.isDragging = false;
            PicEdit.state.crop.isResizing = false;
            PicEdit.state.crop.resizeHandle = null;
        },

        show() {
            const sel = PicEdit.dom.cropSelection;
            const img = PicEdit.dom.preview;

            if (!sel || !img || !PicEdit.state.currentImage) return;

            // Show the selection overlay
            sel.style.display = 'block';

            // Calculate scale
            const scale = PicEdit.state.currentImage.width / img.offsetWidth;
            PicEdit.state.crop.imageScale = scale;

            // Set default crop area (80% centered)
            const imgW = img.offsetWidth;
            const imgH = img.offsetHeight;
            const margin = 0.1;
            const x = imgW * margin;
            const y = imgH * margin;
            const w = imgW * (1 - 2 * margin);
            const h = imgH * (1 - 2 * margin);

            sel.style.left = x + 'px';
            sel.style.top = y + 'px';
            sel.style.width = w + 'px';
            sel.style.height = h + 'px';

            // Update input fields
            if (PicEdit.dom.cropWidth) PicEdit.dom.cropWidth.value = Math.round(w * scale);
            if (PicEdit.dom.cropHeight) PicEdit.dom.cropHeight.value = Math.round(h * scale);
            if (PicEdit.dom.cropX) PicEdit.dom.cropX.value = Math.round(x * scale);
            if (PicEdit.dom.cropY) PicEdit.dom.cropY.value = Math.round(y * scale);

            if (PicEdit.dom.cropDimensions) {
                PicEdit.dom.cropDimensions.textContent = `${Math.round(w * scale)} × ${Math.round(h * scale)}`;
            }
        },

        hide() {
            const sel = PicEdit.dom.cropSelection;
            if (sel) sel.style.display = 'none';
        }
    },

    handlers: {
        handleFileSelect(e) {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                PicEdit.loader.loadImage(files[0]);
            }
        },

        handleDrop(e) {
            e.preventDefault();
            PicEdit.dom.uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                PicEdit.loader.loadImage(files[0]);
            }
        },

        downloadImage() {
            if (PicEdit.state.compressedBlob) {
                const blob = PicEdit.state.compressedBlob;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `picedit_compressed.jpg`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 100);
                PicEdit.ui.showToast(`Downloaded: ${(blob.size / 1024).toFixed(2)} KB`, 'success');
                return;
            }

            const d = PicEdit.dom;
            const format = d.downloadFormat.value;

            const img = new Image();
            img.onload = () => {
                d.canvas.width = img.width;
                d.canvas.height = img.height;
                const ctx = d.canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';

                d.canvas.toBlob((blob) => {
                    PicEdit.ui.showToast('Image ready for download', 'success');
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `picedit_image.${format}`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }, mime, 1.0);
            };
            img.src = d.preview.src;
        }
    },

    loader: {
        loadImage(file) {
            PicEdit.state.originalFileSize = file.size;
            PicEdit.state.compressedBlob = null;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    PicEdit.state.currentImage = img;
                    PicEdit.state.originalImage = img;
                    PicEdit.state.originalAspectRatio = img.width / img.height;

                    PicEdit.dom.preview.src = e.target.result;
                    PicEdit.dom.originalPreview.src = e.target.result;

                    PicEdit.dom.width.value = img.width;
                    PicEdit.dom.height.value = img.height;

                    PicEdit.ui.updateMetadata(file, img);
                    PicEdit.ui.updateCurrentSizeDisplay();
                    PicEdit.ui.showProcessingArea();
                    PicEdit.ui.switchTab('resize');
                    PicEdit.ui.showToast('Image loaded successfully', 'success');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    },

    ui: {
        initTabs() {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });
        },

        switchTab(name) {
            // Update tab buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `${name}Tab`));

            // Update header feature badges
            document.querySelectorAll('.feature-badge[data-tab]').forEach(badge => {
                badge.classList.toggle('active', badge.dataset.tab === name);
            });

            if (name === 'compress') {
                this.updateCurrentSizeDisplay();
                this.updateEstimatedSize();
            }

            // Show/hide crop overlay based on tab
            if (name === 'crop') {
                this.updateCropDisplay();
                // Small delay to ensure image is rendered
                setTimeout(() => PicEdit.crop.show(), 100);
            } else {
                PicEdit.crop.hide();
            }
        },

        updateCropDisplay() {
            const img = PicEdit.state.currentImage;
            if (!img) return;

            if (PicEdit.dom.cropOriginalSize) {
                PicEdit.dom.cropOriginalSize.textContent = `${img.width} × ${img.height} px`;
            }
        },

        applyCropPreset(ratio) {
            const img = PicEdit.state.currentImage;
            const previewImg = PicEdit.dom.preview;
            const sel = PicEdit.dom.cropSelection;
            if (!img || !previewImg || !sel || ratio === 'free') return;

            const [w, h] = ratio.split(':').map(Number);
            const aspectRatio = w / h;

            const imgW = previewImg.offsetWidth;
            const imgH = previewImg.offsetHeight;

            let cropW = imgW * 0.8;
            let cropH = cropW / aspectRatio;

            if (cropH > imgH * 0.8) {
                cropH = imgH * 0.8;
                cropW = cropH * aspectRatio;
            }

            const x = (imgW - cropW) / 2;
            const y = (imgH - cropH) / 2;

            sel.style.left = x + 'px';
            sel.style.top = y + 'px';
            sel.style.width = cropW + 'px';
            sel.style.height = cropH + 'px';

            const scale = PicEdit.state.crop.imageScale;
            if (PicEdit.dom.cropWidth) PicEdit.dom.cropWidth.value = Math.round(cropW * scale);
            if (PicEdit.dom.cropHeight) PicEdit.dom.cropHeight.value = Math.round(cropH * scale);
            if (PicEdit.dom.cropX) PicEdit.dom.cropX.value = Math.round(x * scale);
            if (PicEdit.dom.cropY) PicEdit.dom.cropY.value = Math.round(y * scale);

            if (PicEdit.dom.cropDimensions) {
                PicEdit.dom.cropDimensions.textContent = `${Math.round(cropW * scale)} × ${Math.round(cropH * scale)}`;
            }
        },

        initControls() {
            const d = PicEdit.dom;
            const state = PicEdit.state;

            d.width?.addEventListener('input', () => {
                if (state.aspectRatioLocked) d.height.value = Math.round(d.width.value / state.originalAspectRatio);
            });
            d.height?.addEventListener('input', () => {
                if (state.aspectRatioLocked) d.width.value = Math.round(d.height.value * state.originalAspectRatio);
            });

            ['brightness', 'contrast', 'saturation', 'blur'].forEach(f => {
                document.getElementById(f)?.addEventListener('input', (e) => {
                    document.getElementById(`${f}Value`).textContent = e.target.value;
                    state.filters[f] = parseInt(e.target.value);
                    PicEdit.editor.updateFilterPreview();
                });
            });
        },

        showProcessingArea() {
            PicEdit.dom.uploadSection.style.display = 'none';
            PicEdit.dom.processingArea.style.display = 'block';
        },

        resetToUpload() {
            PicEdit.dom.uploadSection.style.display = 'block';
            PicEdit.dom.processingArea.style.display = 'none';
        },

        updateMetadata(file, img) {
            const sizeKB = (file.size / 1024).toFixed(2);
            PicEdit.dom.imageMetadata.innerHTML = `
                <strong>File:</strong> ${file.name} | <strong>Size:</strong> ${sizeKB} KB | 
                <strong>Dimensions:</strong> ${img.width}×${img.height} px
            `;
            PicEdit.dom.originalInfo.textContent = `${img.width}×${img.height} px • ${sizeKB} KB`;
        },

        updateCurrentSizeDisplay() {
            const sizeKB = (PicEdit.state.originalFileSize / 1024).toFixed(2);
            if (PicEdit.dom.currentSizeDisplay) {
                PicEdit.dom.currentSizeDisplay.textContent = `${sizeKB} KB`;
            }
        },

        updateEstimatedSize() {
            const targetKB = parseInt(PicEdit.dom.targetSize?.value) || 100;
            if (PicEdit.dom.estimatedSizeDisplay) {
                PicEdit.dom.estimatedSizeDisplay.textContent = `~${targetKB} KB`;
            }
        },

        toggleAspectLock() {
            PicEdit.state.aspectRatioLocked = !PicEdit.state.aspectRatioLocked;
            const btn = document.getElementById('lockAspect');
            btn.classList.toggle('active');
            btn.querySelector('i').className = PicEdit.state.aspectRatioLocked ? 'fas fa-lock' : 'fas fa-unlock';
        },

        toggleComparison() {
            const cv = PicEdit.dom.comparisonView;
            const sv = PicEdit.dom.singleView;
            const isComparing = cv.style.display !== 'none';
            cv.style.display = isComparing ? 'none' : 'grid';
            sv.style.display = isComparing ? 'block' : 'none';
            document.getElementById('compareBtn').classList.toggle('active');
        },

        applyPresetFilter(name) {
            const presets = {
                grayscale: { brightness: 100, contrast: 100, saturation: 0, blur: 0 },
                sepia: { brightness: 110, contrast: 90, saturation: 80, blur: 0 },
                vintage: { brightness: 110, contrast: 120, saturation: 70, blur: 0 },
                vibrant: { brightness: 105, contrast: 110, saturation: 150, blur: 0 },
                reset: { brightness: 100, contrast: 100, saturation: 100, blur: 0 }
            };
            PicEdit.state.filters = presets[name];
            Object.entries(PicEdit.state.filters).forEach(([k, v]) => {
                const el = document.getElementById(k);
                if (el) { el.value = v; document.getElementById(`${k}Value`).textContent = v; }
            });
            PicEdit.editor.updateFilterPreview();
        },

        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const iconMap = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                info: 'fa-info-circle'
            };

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<i class="fas ${iconMap[type]}"></i><span>${message}</span>`;

            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    },

    editor: {
        applyResize() {
            if (!PicEdit.state.currentImage) return;
            PicEdit.state.compressedBlob = null;

            const d = PicEdit.dom;
            const width = parseInt(d.width.value);
            const height = parseInt(d.height.value);

            d.canvas.width = width;
            d.canvas.height = height;
            const ctx = d.canvas.getContext('2d');
            ctx.drawImage(PicEdit.state.currentImage, 0, 0, width, height);

            const format = d.outputFormat.value;
            const dataUrl = d.canvas.toDataURL(`image/${format}`, 1.0);

            this.updatePreview(dataUrl);
            this.updateProcessedInfo(dataUrl, width, height);
            PicEdit.dom.downloadSection.style.display = 'flex';
            PicEdit.ui.showToast('Resize applied', 'success');
        },

        applyCompress() {
            if (!PicEdit.state.currentImage) return;

            const targetKB = parseInt(PicEdit.dom.targetSize?.value) || 100;
            const targetBytes = targetKB * 1024;
            const img = PicEdit.state.currentImage;
            const canvas = PicEdit.dom.canvas;

            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            PicEdit.ui.showToast('Compressing...', 'info');

            let minQuality = 0.01, maxQuality = 1.0, bestBlob = null, iterations = 0;

            const tryQuality = (quality) => new Promise((resolve) => {
                canvas.toBlob((blob) => resolve({ blob, quality }), 'image/jpeg', quality);
            });

            const findOptimal = async () => {
                const minResult = await tryQuality(0.01);
                if (minResult.blob.size > targetBytes) {
                    const scaleFactor = Math.sqrt(targetBytes / minResult.blob.size);
                    canvas.width = Math.floor(img.width * scaleFactor);
                    canvas.height = Math.floor(img.height * scaleFactor);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                while (iterations++ < 15) {
                    const q = (minQuality + maxQuality) / 2;
                    const r = await tryQuality(q);
                    if (!bestBlob || Math.abs(r.blob.size - targetBytes) < Math.abs(bestBlob.size - targetBytes)) bestBlob = r.blob;
                    if (Math.abs(r.blob.size - targetBytes) < targetBytes * 0.05) break;
                    if (r.blob.size > targetBytes) maxQuality = q; else minQuality = q;
                }
                return bestBlob;
            };

            findOptimal().then((blob) => {
                PicEdit.state.compressedBlob = blob;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.updatePreview(e.target.result);
                    const kb = (blob.size / 1024).toFixed(2);
                    PicEdit.dom.processedInfo.textContent = `${canvas.width}×${canvas.height} px • ${kb} KB`;
                    PicEdit.dom.estimatedSizeDisplay.textContent = `${kb} KB (actual)`;
                    PicEdit.dom.downloadSection.style.display = 'flex';
                    PicEdit.ui.showToast(`Compressed to ${kb} KB`, 'success');
                };
                reader.readAsDataURL(blob);
            });
        },

        applyFilters() {
            if (!PicEdit.state.currentImage) return;
            PicEdit.state.compressedBlob = null;

            const f = PicEdit.state.filters;
            const cvs = PicEdit.dom.canvas;
            const ctx = cvs.getContext('2d');

            cvs.width = PicEdit.state.currentImage.width;
            cvs.height = PicEdit.state.currentImage.height;

            ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
            ctx.drawImage(PicEdit.state.currentImage, 0, 0);

            const dataUrl = cvs.toDataURL('image/png', 1.0);
            this.updatePreview(dataUrl);
            PicEdit.dom.downloadSection.style.display = 'flex';
            PicEdit.ui.showToast('Filters applied', 'success');
        },

        updatePreview(dataUrl) {
            const img = new Image();
            img.onload = () => {
                PicEdit.state.currentImage = img;
                PicEdit.dom.preview.src = dataUrl;
                PicEdit.dom.processedPreview.src = dataUrl;
                PicEdit.dom.preview.style.filter = 'none';
            };
            img.src = dataUrl;
        },

        updateFilterPreview() {
            const f = PicEdit.state.filters;
            PicEdit.dom.preview.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
        },

        resetImage() {
            PicEdit.state.currentImage = PicEdit.state.originalImage;
            PicEdit.state.compressedBlob = null;
            PicEdit.dom.preview.src = PicEdit.state.originalImage.src;
            PicEdit.dom.preview.style.filter = 'none';
            PicEdit.ui.applyPresetFilter('reset');
            PicEdit.ui.showToast('Image reset to original', 'info');
        },

        applyCrop() {
            if (!PicEdit.state.currentImage) return;
            PicEdit.state.compressedBlob = null;

            const img = PicEdit.state.currentImage;
            const cropW = parseInt(PicEdit.dom.cropWidth?.value) || img.width;
            const cropH = parseInt(PicEdit.dom.cropHeight?.value) || img.height;
            const cropX = parseInt(PicEdit.dom.cropX?.value) || 0;
            const cropY = parseInt(PicEdit.dom.cropY?.value) || 0;

            if (cropX < 0 || cropY < 0 || cropX + cropW > img.width || cropY + cropH > img.height) {
                PicEdit.ui.showToast('Crop area exceeds image bounds!', 'error');
                return;
            }

            if (cropW <= 0 || cropH <= 0) {
                PicEdit.ui.showToast('Invalid crop dimensions!', 'error');
                return;
            }

            const canvas = PicEdit.dom.canvas;
            canvas.width = cropW;
            canvas.height = cropH;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            const dataUrl = canvas.toDataURL('image/png', 1.0);
            this.updatePreview(dataUrl);
            this.updateProcessedInfo(dataUrl, cropW, cropH);

            PicEdit.crop.hide();
            PicEdit.dom.downloadSection.style.display = 'flex';
            PicEdit.ui.showToast(`Cropped to ${cropW}×${cropH} px`, 'success');
        },

        updateProcessedInfo(dataUrl, w, h) {
            const size = Math.round((dataUrl.length - 22) * 3 / 4) / 1024;
            PicEdit.dom.processedInfo.textContent = `${w}×${h} px • ${size.toFixed(2)} KB`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => PicEdit.init());