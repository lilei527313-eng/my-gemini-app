import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, History, Trash2, ChevronLeft, ChevronRight, Plus, X, Check, Save, Info, Settings, Download, Upload, Folder, FolderPlus, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import confetti from 'canvas-confetti';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

interface Photo {
  id: number;
  project_id: number;
  filename: string;
  original_date: string;
  caption: string;
  created_at: string;
}

export default function App() {
  const [appTitle, setAppTitle] = useState(() => localStorage.getItem('app_title') || "OCEAN'S CHRONICLE");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [view, setView] = useState<'projects' | 'gallery' | 'camera' | 'timeline' | 'settings'>('projects');
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  // Camera & Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStorage.setItem('app_title', appTitle);
  }, [appTitle]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      fetchPhotos(currentProject.id);
    }
  }, [currentProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (projectId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/photos?project_id=${projectId}`);
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      console.error('Failed to fetch photos', err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects([project, ...projects]);
        setNewProjectName('');
        setShowNewProjectModal(false);
        setCurrentProject(project);
        setView('gallery');
      }
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm('确定要删除整个项目及其所有照片吗？此操作不可恢复。')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id));
        if (currentProject?.id === id) setCurrentProject(null);
        setView('projects');
      }
    } catch (err) {
      console.error('Delete project failed', err);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setView('camera');
      setPreviewImage(null);
      setPreviewBlob(null);
    } catch (err) {
      alert('无法访问摄像头，请检查权限设置。');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPreviewImage(dataUrl);
    canvas.toBlob((blob) => setPreviewBlob(blob), 'image/jpeg', 0.7);
  };

  const savePhoto = async () => {
    if (!previewBlob || !currentProject) return;
    const formData = new FormData();
    formData.append('image', previewBlob, 'capture.jpg');
    formData.append('project_id', currentProject.id.toString());
    formData.append('original_date', new Date().toISOString());
    try {
      setIsCapturing(true);
      const res = await fetch('/api/photos', { method: 'POST', body: formData });
      if (res.ok) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        await fetchPhotos(currentProject.id);
        stopCamera();
        setView('gallery');
        setPreviewImage(null);
        setPreviewBlob(null);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const deletePhoto = async (id: number) => {
    if (!confirm('确定要删除这张珍贵的记录吗？')) return;
    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPhotos(photos.filter(p => p.id !== id));
        if (selectedPhoto?.id === id) setSelectedPhoto(null);
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const exportBackup = () => { window.location.href = '/api/backup/export'; };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('导入备份将覆盖当前所有数据，确定继续吗？')) return;
    const formData = new FormData();
    formData.append('backup', file);
    try {
      setLoading(true);
      const res = await fetch('/api/backup/import', { method: 'POST', body: formData });
      if (res.ok) { alert('导入成功，应用将刷新'); window.location.reload(); }
      else { alert('导入失败'); }
    } catch (err) { console.error('Import failed', err); }
    finally { setLoading(false); }
  };

  const lastPhoto = photos.length > 0 ? photos[0] : null;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-brand-bg shadow-2xl relative overflow-hidden border-x border-brand-accent/10">
      {/* Header - Classical Style */}
      <header className="p-10 pb-6 flex flex-col items-center gap-6 z-10">
        <div className="flex flex-col items-center text-center">
          <div onClick={() => setView('projects')} className="cursor-pointer group space-y-2">
            <h1 className="classical-title text-4xl text-brand-ink tracking-tight uppercase">
              {appTitle}
            </h1>
            <div className="ornament" />
          </div>
          <div className="flex gap-4 mt-2">
            <button onClick={() => setView('settings')} className="text-brand-muted hover:text-brand-accent transition-colors">
              <Settings size={18} />
            </button>
            <button onClick={() => setShowGuide(!showGuide)} className="text-brand-muted hover:text-brand-accent transition-colors">
              <Info size={18} />
            </button>
          </div>
        </div>
        <div className="w-full flex justify-between items-center border-y border-brand-accent/10 py-3">
          <p className="text-[10px] font-sans uppercase tracking-[0.3em] text-brand-muted">
            {view === 'projects' ? 'Archives Index' : currentProject?.name}
          </p>
          <p className="text-[10px] font-sans uppercase tracking-[0.3em] text-brand-muted">
            {format(new Date(), 'MMMM dd, yyyy')}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {view === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 space-y-10">
              <div className="space-y-12">
                {projects.map((project, idx) => (
                  <motion.div 
                    key={project.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group cursor-pointer text-center space-y-4"
                    onClick={() => { setCurrentProject(project); setView('gallery'); }}
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans uppercase tracking-[0.4em] text-brand-accent">
                        Volume {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="classical-title text-3xl text-brand-ink group-hover:italic transition-all duration-500">
                        {project.name}
                      </h3>
                      <p className="text-xs italic text-brand-muted">
                        Established in {format(new Date(project.created_at), 'yyyy')}
                      </p>
                    </div>
                    <div className="ornament scale-50 opacity-30 group-hover:scale-100 group-hover:opacity-100 transition-all duration-700" />
                  </motion.div>
                ))}
                
                <button 
                  onClick={() => setShowNewProjectModal(true)}
                  className="w-full py-12 border border-brand-accent/10 rounded-sm flex flex-col items-center justify-center gap-4 text-brand-muted hover:bg-white hover:border-brand-accent transition-all duration-500"
                >
                  <Plus size={24} className="opacity-40" />
                  <span className="text-[10px] font-sans uppercase tracking-[0.3em]">New Archive</span>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'gallery' && (
            <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 space-y-10">
              <div className="flex flex-col items-center gap-4 text-center">
                <button onClick={() => setView('projects')} className="text-[10px] font-sans uppercase tracking-[0.3em] text-brand-muted hover:text-brand-accent transition-colors">
                  Return to Index
                </button>
                <div className="ornament scale-75" />
                <span className="text-xs italic text-brand-muted">
                  {photos.length} Captured Moments
                </span>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><div className="animate-pulse text-brand-accent font-display italic">Loading Archives...</div></div>
              ) : photos.length === 0 ? (
                <div className="text-center py-20 space-y-8">
                  <p className="text-lg italic text-brand-muted">The archive is currently empty.</p>
                  <button onClick={startCamera} className="classical-btn">Begin Recording</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8">
                  {photos.map((photo, idx) => (
                    <motion.div
                      layoutId={`photo-${photo.id}`}
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="space-y-4 cursor-pointer group"
                    >
                      <div className="aspect-[3/4] overflow-hidden classical-card p-2">
                        <img 
                          src={`/uploads/${photo.filename}`} 
                          className="w-full h-full object-cover sepia-[0.3] group-hover:sepia-0 transition-all duration-1000"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[10px] font-sans uppercase tracking-widest text-brand-muted">Entry {String(idx + 1).padStart(3, '0')}</p>
                        <p className="text-[10px] italic text-brand-ink/60">{format(new Date(photo.original_date), 'MMM dd, yyyy')}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'camera' && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-brand-bg flex flex-col">
              <div className="relative flex-1 overflow-hidden flex items-center justify-center p-10">
                {!previewImage ? (
                  <div className="relative w-full h-full classical-card p-4 overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover sepia-[0.2]" />
                    
                    {/* Classical Overlays */}
                    <div className="absolute inset-8 border border-brand-accent/20 pointer-events-none" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-brand-accent/10 pointer-events-none" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-brand-accent/10 pointer-events-none" />

                    {lastPhoto && (
                      <div className="absolute inset-4 opacity-20 pointer-events-none mix-blend-multiply">
                        <img src={`/uploads/${lastPhoto.filename}`} className="w-full h-full object-cover sepia" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    <button onClick={() => { stopCamera(); setView('gallery'); }} className="absolute top-8 left-8 p-3 bg-brand-ink text-white rounded-sm">
                      <X size={20} />
                    </button>

                    <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center">
                      <button onClick={handleCapture} className="w-20 h-20 rounded-full border border-brand-accent flex items-center justify-center p-1 group">
                        <div className="w-full h-full rounded-full bg-brand-accent/20 group-active:bg-brand-accent transition-colors" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full classical-card p-4 overflow-hidden">
                    <img src={previewImage} className="w-full h-full object-cover" />
                    <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-12 px-10">
                      <button onClick={() => setPreviewImage(null)} className="text-[10px] font-sans uppercase tracking-widest text-brand-muted underline underline-offset-8">
                        Discard
                      </button>
                      <button onClick={savePhoto} disabled={isCapturing} className="classical-btn">
                        {isCapturing ? 'Saving...' : 'Preserve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 space-y-12">
              <div className="flex flex-col items-center text-center gap-6">
                <button onClick={() => setView('projects')} className="p-3 border border-brand-accent/20 rounded-sm text-brand-muted">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="classical-title text-3xl">Archive Configuration</h2>
                <div className="ornament scale-75" />
              </div>

              <div className="space-y-12">
                <div className="space-y-4">
                  <label className="text-[10px] font-sans uppercase tracking-[0.3em] text-brand-muted">Archive Title</label>
                  <input 
                    type="text" 
                    value={appTitle} 
                    onChange={(e) => setAppTitle(e.target.value.toUpperCase())}
                    className="w-full p-4 bg-white border border-brand-accent/20 rounded-sm outline-none focus:border-brand-accent transition-colors font-display italic text-xl text-brand-ink"
                  />
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-accent">
                      <Download size={18} />
                      <h3 className="text-[10px] font-sans uppercase tracking-widest">Preservation</h3>
                    </div>
                    <button onClick={exportBackup} className="w-full classical-btn">Export Archive ZIP</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-muted">
                      <Upload size={18} />
                      <h3 className="text-[10px] font-sans uppercase tracking-widest">Restoration</h3>
                    </div>
                    <label className="block w-full py-3 border border-brand-accent/20 text-brand-muted rounded-sm text-[10px] font-sans uppercase tracking-widest text-center cursor-pointer hover:bg-white transition-colors">
                      Import Archive ZIP
                      <input type="file" accept=".zip" onChange={importBackup} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 space-y-16">
              <div className="flex flex-col items-center gap-4 text-center">
                <button onClick={() => setView('gallery')} className="text-[10px] font-sans uppercase tracking-[0.3em] text-brand-muted hover:text-brand-accent transition-colors">
                  Return to Gallery
                </button>
                <div className="ornament scale-75" />
                <span className="text-xs italic text-brand-muted">
                  Chronological Progression
                </span>
              </div>

              <div className="space-y-24 relative">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="time-marker">
                    <div className="space-y-6">
                      <div className="flex justify-between items-baseline">
                        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-brand-accent">
                          {format(new Date(photo.original_date), 'MMMM dd, yyyy')}
                        </p>
                        <span className="text-[10px] italic text-brand-muted">Folio {String(photos.length - idx).padStart(3, '0')}</span>
                      </div>
                      <div className="classical-card p-3">
                        <img 
                          src={`/uploads/${photo.filename}`} 
                          className="w-full h-full object-cover sepia-[0.2] hover:sepia-0 transition-all duration-1000"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-center">
                        <div className="ornament scale-50 opacity-20" />
                        <p className="font-serif italic text-sm text-brand-ink/60">
                          Captured in the month of {format(new Date(photo.original_date), 'MMMM', { locale: zhCN })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-brand-bg/95 backdrop-blur-sm flex items-center justify-center p-10">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full classical-card p-10 space-y-10 text-center">
              <h3 className="classical-title text-3xl text-brand-ink">New Archive</h3>
              <div className="ornament" />
              <div className="space-y-4">
                <label className="text-[10px] font-sans text-brand-muted uppercase tracking-[0.3em]">Archive Name</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full p-4 bg-transparent border-b border-brand-accent/30 outline-none text-2xl font-display italic text-center"
                  autoFocus
                />
              </div>
              <div className="flex gap-8">
                <button onClick={() => setShowNewProjectModal(false)} className="flex-1 py-4 text-brand-muted font-sans text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={createProject} className="flex-1 classical-btn">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Bar - Classical */}
      {view !== 'camera' && view !== 'settings' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-10 z-20">
          <div className="bg-white/80 backdrop-blur-md border border-brand-accent/10 p-2 rounded-sm flex justify-around items-center shadow-lg">
            <button onClick={() => setView('projects')} className={`p-4 transition-all ${view === 'projects' ? 'text-brand-accent' : 'text-brand-muted hover:text-brand-ink'}`}>
              <Folder size={20} />
            </button>
            <button onClick={startCamera} className="w-16 h-16 bg-brand-ink rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all">
              <Plus size={28} />
            </button>
            <button onClick={() => setView('timeline')} className={`p-4 transition-all ${view === 'timeline' ? 'text-brand-accent' : 'text-brand-muted hover:text-brand-ink'}`}>
              <History size={20} />
            </button>
          </div>
        </nav>
      )}

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-brand-bg flex flex-col">
            <div className="relative flex-1 flex items-center justify-center p-10">
              <div className="classical-card w-full h-full relative p-4 bg-white">
                <motion.img 
                  layoutId={`photo-${selectedPhoto.id}`}
                  src={`/uploads/${selectedPhoto.filename}`} 
                  className="w-full h-full object-contain sepia-[0.1]"
                  referrerPolicy="no-referrer"
                />
                <button onClick={() => setSelectedPhoto(null)} className="absolute top-8 left-8 p-3 bg-brand-ink text-white rounded-sm">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => deletePhoto(selectedPhoto.id)} className="absolute top-8 right-8 p-3 bg-brand-bg border border-brand-accent/20 text-brand-accent rounded-sm">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <div className="p-12 space-y-10 bg-white border-t border-brand-accent/10 text-center">
              <div className="space-y-4">
                <p className="text-[10px] font-sans uppercase tracking-[0.4em] text-brand-muted">Moment Preserved</p>
                <h2 className="classical-title text-4xl text-brand-ink">
                  {format(new Date(selectedPhoto.original_date), 'dd MMMM yyyy')}
                </h2>
                <div className="ornament scale-75" />
                <p className="font-serif italic text-lg text-brand-muted">Archive: {currentProject?.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
