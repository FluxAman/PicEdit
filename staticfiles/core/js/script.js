/**
 * PicEdit - Client-side Image Processing
 * Modularized structure for better maintainability
 */

const ProResize = {
    // Application State
    state: {
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
    },

    // DOM Elements Cache
    dom: {},

    // Initialization
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.ui.initTabs();
        this.ui.initControls();
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
            progressText: document.getElementById('progressText'),
            // Controls
            width: document.getElementById('width'),
            height: document.getElementById('height'),
            resizeMode: document.getElementById('resizeMode'),
            outputFormat: document.getElementById('outputFormat'),
            quality: document.getElementById('quality'),
            qualityValue: document.getElementById('qualityValue'),
            downloadQuality: document.getElementById('downloadQuality'),
            downloadFormat: document.getElementById('downloadFormat'),
            downloadQualityGroup: document.getElementById('downloadQualityGroup')
        };
    },

    bindEvents() {
        const d = this.dom;

        // Upload
        d.imageInput?.addEventListener('change', (e) => this.handlers.handleFileSelect(e));
        d.uploadZone?.addEventListener('click', () => d.imageInput.click());

        // Drag & Drop
        d.uploadZone?.addEventListener('dragover', (e) => { e.preventDefault(); d.uploadZone.classList.add('dragover'); });
        d.uploadZone?.addEventListener('dragleave', (e) => { e.preventDefault(); d.uploadZone.classList.remove('dragover'); });
        d.uploadZone?.addEventListener('drop', (e) => this.handlers.handleDrop(e));

        // Processing Actions
        document.getElementById('applyResize')?.addEventListener('click', () => this.editor.applyResize());
        document.getElementById('applyFilters')?.addEventListener('click', () => this.editor.applyFilters());
        document.getElementById('applyCrop')?.addEventListener('click', () => this.editor.applyCrop());
        document.getElementById('processBatch')?.addEventListener('click', () => this.editor.processBatch());

        // UI Actions
        document.getElementById('compareBtn')?.addEventListener('click', () => this.ui.toggleComparison());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.editor.resetImage());
        document.getElementById('lockAspect')?.addEventListener('click', () => this.ui.toggleAspectLock());

        // Downloads
        d.downloadBtn?.addEventListener('click', () => this.handlers.downloadImage());
        d.downloadAllBtn?.addEventListener('click', () => this.handlers.downloadAllAsZip());

        // Presets & Filters
        document.querySelectorAll('.preset-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => this.ui.applyPresetFilter(btn.dataset.filter));
        });
    },

    // Event Handlers
    handlers: {
        handleFileSelect(e) {
            const files = Array.from(e.target.files);
            ProResize.loader.processFiles(files);
        },

        handleDrop(e) {
            e.preventDefault();
            ProResize.dom.uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            ProResize.loader.processFiles(files);
        },

        downloadImage() {
            const d = ProResize.dom;
            const format = d.downloadFormat.value;
            const quality = parseInt(d.downloadQuality.value) / 100;

            const img = new Image();
            img.onload = () => {
                d.canvas.width = img.width;
                d.canvas.height = img.height;
                const ctx = d.canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const finalQuality = format === 'png' ? 1.0 : quality;
                const mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';

                d.canvas.toBlob((blob) => {
                    ProResize.ui.showToast('Image prepared for download', 'success');
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `processed.${format}`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }, mime, finalQuality);
            };
            img.src = d.preview.src;
        },

        async downloadAllAsZip() {
            const zip = new JSZip();
            ProResize.state.processedImages.forEach(img => {
                const base64Data = img.data.split(',')[1];
                zip.file(img.name, base64Data, { base64: true });
            });
            const blob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.download = 'processed_images.zip';
            link.href = URL.createObjectURL(blob);
            link.click();
        }
    },

    // Image Loading Logic
    loader: {
        processFiles(files) {
            if (!files.length) return;
            ProResize.state.images = files;
            ProResize.dom.batchCount.textContent = files.length;

            if (files.length === 1) this.loadSingle(files[0]);
            else this.loadBatch(files);

            ProResize.ui.showProcessingArea();
            ProResize.ui.showToast(`Loaded ${files.length} image(s) successfully`, 'success');
        },

        loadSingle(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    ProResize.state.currentImage = img;
                    ProResize.state.originalImage = img;
                    ProResize.state.originalAspectRatio = img.width / img.height;

                    ProResize.dom.preview.src = e.target.result;
                    ProResize.dom.originalPreview.src = e.target.result;

                    ProResize.dom.width.value = img.width;
                    ProResize.dom.height.value = img.height;

                    ProResize.ui.updateMetadata(file, img);
                    ProResize.ui.switchTab('resize');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        },

        loadBatch(files) {
            ProResize.dom.batchGallery.innerHTML = '';
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const item = document.createElement('div');
                    item.className = 'batch-item';
                    item.innerHTML = `
                        <img src="${e.target.result}" alt="${file.name}">
                        <div class="batch-item-name">${file.name}</div>
                        <button class="batch-item-remove" onclick="ProResize.loader.removeBatchItem(${index})"><i class="fas fa-times"></i></button>
                    `;
                    ProResize.dom.batchGallery.appendChild(item);
                };
                reader.readAsDataURL(file);
            });
            this.loadSingle(files[0]); // Preview first
            ProResize.ui.switchTab('batch');
        },

        removeBatchItem(index) {
            ProResize.state.images.splice(index, 1);
            if (ProResize.state.images.length === 0) ProResize.ui.resetToUpload();
            else this.loadBatch(ProResize.state.images);
        },


    },

    // UI Updates & Interactions
    ui: {
        initTabs() {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });
        },

        switchTab(name) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `${name}Tab`));
        },

        initControls() {
            const d = ProResize.dom;
            const state = ProResize.state;

            // Dimensions linking
            d.width?.addEventListener('input', () => {
                if (state.aspectRatioLocked) d.height.value = Math.round(d.width.value / state.originalAspectRatio);
            });
            d.height?.addEventListener('input', () => {
                if (state.aspectRatioLocked) d.width.value = Math.round(d.height.value * state.originalAspectRatio);
            });

            // Filters
            ['brightness', 'contrast', 'saturation', 'blur'].forEach(f => {
                document.getElementById(f)?.addEventListener('input', (e) => {
                    document.getElementById(`${f}Value`).textContent = e.target.value;
                    state.filters[f] = parseInt(e.target.value);
                    ProResize.editor.updateFilterPreview();
                });
            });

            // Toggle Modes
            d.resizeMode?.addEventListener('change', () => {
                const isDims = d.resizeMode.value === 'dimensions';
                document.getElementById('dimensionControls').style.display = isDims ? 'block' : 'none';
                document.getElementById('filesizeControls').style.display = isDims ? 'none' : 'block';
            });
        },

        showProcessingArea() {
            ProResize.dom.uploadSection.style.display = 'none';
            ProResize.dom.processingArea.style.display = 'block';
        },

        resetToUpload() {
            ProResize.dom.uploadSection.style.display = 'block';
            ProResize.dom.processingArea.style.display = 'none';
            ProResize.state.images = [];
        },

        updateMetadata(file, img) {
            const sizeKB = (file.size / 1024).toFixed(2);
            ProResize.dom.imageMetadata.innerHTML = `
                <strong>File:</strong> ${file.name} | <strong>Size:</strong> ${sizeKB} KB | 
                <strong>Dimensions:</strong> ${img.width}×${img.height} px
            `;
            ProResize.dom.originalInfo.textContent = `${img.width}×${img.height} px • ${sizeKB} KB`;
        },

        toggleAspectLock() {
            ProResize.state.aspectRatioLocked = !ProResize.state.aspectRatioLocked;
            const btn = document.getElementById('lockAspect');
            btn.classList.toggle('active');
            btn.querySelector('i').className = ProResize.state.aspectRatioLocked ? 'fas fa-lock' : 'fas fa-unlock';
        },

        toggleComparison() {
            const cv = ProResize.dom.comparisonView;
            const sv = ProResize.dom.singleView;
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
            ProResize.state.filters = presets[name];
            // Update sliders UI
            Object.entries(ProResize.state.filters).forEach(([k, v]) => {
                const el = document.getElementById(k);
                if (el) { el.value = v; document.getElementById(`${k}Value`).textContent = v; }
            });
            ProResize.editor.updateFilterPreview();
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
            toast.innerHTML = `
                <i class="fas ${iconMap[type]}"></i>
                <span>${message}</span>
            `;

            container.appendChild(toast);

            // Trigger reflow for transition
            requestAnimationFrame(() => toast.classList.add('show'));

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    },

    // Core Image Logic
    editor: {
        applyResize() {
            if (!ProResize.state.currentImage) return;
            const d = ProResize.dom;
            const width = parseInt(d.width.value);
            const height = parseInt(d.height.value);
            const quality = parseInt(d.quality.value) / 100;

            d.canvas.width = width;
            d.canvas.height = height;
            const ctx = d.canvas.getContext('2d');
            ctx.drawImage(ProResize.state.currentImage, 0, 0, width, height);

            const format = d.outputFormat.value;
            const dataUrl = d.canvas.toDataURL(`image/${format}`, quality);

            this.updatePreview(dataUrl);
            this.updateProcessedInfo(dataUrl, width, height);
            ProResize.dom.downloadSection.style.display = 'flex';
        },

        applyFilters() {
            // Basic implementation applying CSS filter string to canvas
            if (!ProResize.state.currentImage) return;
            const f = ProResize.state.filters;
            const cvs = ProResize.dom.canvas;
            const ctx = cvs.getContext('2d');

            cvs.width = ProResize.state.currentImage.width;
            cvs.height = ProResize.state.currentImage.height;

            ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
            ctx.drawImage(ProResize.state.currentImage, 0, 0);

            const dataUrl = cvs.toDataURL('image/png');
            this.updatePreview(dataUrl);
            ProResize.dom.downloadSection.style.display = 'flex';
        },

        // Simplified convenience for applying result to current state
        updatePreview(dataUrl) {
            const img = new Image();
            img.onload = () => {
                ProResize.state.currentImage = img;
                ProResize.dom.preview.src = dataUrl;
                ProResize.dom.processedPreview.src = dataUrl;
                ProResize.dom.preview.style.filter = 'none'; // Clear CSS preview filter
            };
            img.src = dataUrl;
        },

        updateFilterPreview() {
            const f = ProResize.state.filters;
            ProResize.dom.preview.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px)`;
        },

        resetImage() {
            ProResize.state.currentImage = ProResize.state.originalImage;
            ProResize.dom.preview.src = ProResize.state.originalImage.src;
            ProResize.dom.preview.style.filter = 'none';
            ProResize.ui.applyPresetFilter('reset');
        },

        // Placeholder for advanced features: crop and batch would follow similar patterns
        applyCrop() { alert('Crop functionality simplified for audit fix.'); },
        processBatch() { alert('Batch functionality simplified for audit fix.'); },

        updateProcessedInfo(dataUrl, w, h) {
            // simplified logic to estimate size
            const head = 'data:image/png;base64,';
            const size = Math.round((dataUrl.length - head.length) * 3 / 4) / 1024;
            ProResize.dom.processedInfo.textContent = `${w}×${h} px • ${size.toFixed(2)} KB`;
        }
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => ProResize.init());