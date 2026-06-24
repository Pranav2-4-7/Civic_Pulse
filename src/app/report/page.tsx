"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { uploadImage, addIssue } from "@/lib/firebase";

const ReportMapSelector = dynamic(() => import("@/components/ReportMapSelector"), { ssr: false });

// Helper to extract frame from video at 1.0s
const extractFrameFromVideo = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.playsInline = true;
    video.muted = true;
    video.currentTime = 1; // Seek to 1 second
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const frameFile = new File([blob], `frame_${file.name.replace(/\.[^/.]+$/, "")}.jpg`, {
                type: "image/jpeg",
              });
              resolve(frameFile);
            } else {
              reject(new Error("Failed to capture frame blob."));
            }
          }, "image/jpeg");
        } else {
          reject(new Error("Failed to get 2D canvas context."));
        }
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(video.src);
      }
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(video.src);
      reject(err);
    };
  });
};

export default function ReportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "analyzing" | "success" | "error">("idle");
  const [progressMessage, setProgressMessage] = useState("");

  // AI predicted fields
  const [category, setCategory] = useState("Infrastructure Integrity");
  const [subcategory, setSubcategory] = useState("Pavement Deformation");
  const [severity, setSeverity] = useState("LEVEL 4");
  const [summary, setSummary] = useState("Automated visual analysis confirms localized asphalt structural failure. Multiple fractures detected exceeding 20mm width. Proximity to drainage suggests potential sub-surface erosion. Recommend immediate site inspection and preventative sealing.");
  const [keywords, setKeywords] = useState<string[]>(["pothole", "asphalt", "structural-failure"]);

  // Geolocation states
  const [latitude, setLatitude] = useState(12.9716);
  const [longitude, setLongitude] = useState(77.5946);
  const [isLocating, setIsLocating] = useState(false);

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("Submit Report to CivicPulse");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // File Upload Handlers
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    try {
      setImageFile(file);
      setIsUploading(true);
      setUploadStatus("uploading");
      
      let fileToUpload = file;
      const isVideo = file.type.startsWith("video/");

      if (isVideo) {
        setProgressMessage("Extracting key frame from video...");
        fileToUpload = await extractFrameFromVideo(file);
      }

      setProgressMessage("Uploading to Firebase Storage...");
      // Upload to Firebase Storage (falls back to local base64 if Firebase is empty)
      const uploadedUrl = await uploadImage(fileToUpload);
      setImageUrl(uploadedUrl);

      // Send image payload to /api/analyze
      setUploadStatus("analyzing");
      setProgressMessage("Analyzing Visual Data with Gemini...");

      const formData = new FormData();
      formData.append("image", fileToUpload);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to classify asset. Ensure GEMINI_API_KEY is configured.");
      }

      const aiResult = await response.json();

      // Populate AI predicted fields
      setCategory(aiResult.category || "Infrastructure Integrity");
      setSubcategory(aiResult.subcategory || "Visual Defect");
      setSeverity(aiResult.severity || "LEVEL 3");
      setSummary(aiResult.short_summary || "Visual analysis completed successfully.");
      setKeywords(aiResult.keywords || ["civic-issue"]);

      setUploadStatus("success");
      setProgressMessage(`${file.name} Analyzed Successfully`);
    } catch (error: unknown) {
      console.error(error);
      setUploadStatus("error");
      const errMsg = error instanceof Error ? error.message : "Failed to process asset.";
      setProgressMessage(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please ensure you're using HTTPS and a modern browser.");
      return;
    }
    
    setIsLocating(true);
    console.log("Starting geolocation detection...");

    // High accuracy options
    const optionsHigh = { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0 
    };

    // Low accuracy options (fallback)
    const optionsLow = { 
      enableHighAccuracy: false, 
      timeout: 15000, 
      maximumAge: 60000 
    };

    // Success callback function
    const onLocationSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      console.log(`✓ Location detected: ${latitude}, ${longitude}`);
      setLatitude(latitude);
      setLongitude(longitude);
      setIsLocating(false);
      alert(`Location detected! Latitude: ${latitude.toFixed(4)}, Longitude: ${longitude.toFixed(4)}`);
    };

    // Error callback for high accuracy
    const onHighAccuracyError = (error: GeolocationPositionError) => {
      console.warn("High accuracy geolocation failed, retrying with low accuracy:", error);
      
      if (error.code === error.PERMISSION_DENIED) {
        console.error("Location permission denied by user");
        alert("Location permission was denied. To use geolocation:\n1. Check your browser settings\n2. Look for location permissions in the address bar\n3. Allow access for this site\n\nOr manually select your location on the map.");
        setIsLocating(false);
        return;
      }

      // Try low accuracy as fallback
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (lowAccError) => {
          console.error("Low accuracy geolocation also failed:", lowAccError);
          let userMsg = "Failed to detect location. Please select on the map manually.\n\nTroubleshooting:\n• Ensure you're using HTTPS\n• Check browser location permissions\n• Try a different browser\n• Check if location services are enabled on your device";
          
          if (lowAccError.code === lowAccError.PERMISSION_DENIED) {
            userMsg = "Location permission denied. Please check your browser settings and allow location access for this site.";
          } else if (lowAccError.code === lowAccError.POSITION_UNAVAILABLE) {
            userMsg = "Location information is unavailable. Please check if location services are enabled on your device.";
          } else if (lowAccError.code === lowAccError.TIMEOUT) {
            userMsg = "Location request timed out. Please check your internet connection and try again.";
          }
          
          alert(userMsg);
          setIsLocating(false);
        },
        optionsLow
      );
    };

    // Request high accuracy first
    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      onHighAccuracyError,
      optionsHigh
    );
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      alert("Please upload and analyze an image or video before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitMessage("Processing Encryption...");

      const latDir = latitude >= 0 ? "N" : "S";
      const lngDir = longitude >= 0 ? "E" : "W";
      const gridString = `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lngDir}`;

      const issueData = {
        category,
        subcategory,
        severity,
        short_summary: summary,
        keywords,
        imageUrl,
        user_metadata: {
          reporter: "Grid Sentinel Alpha",
          role: "Citizen Reporter"
        },
        location: {
          latitude,
          longitude,
          grid: gridString
        },
        status: "reported" as const
      };

      // Save unified record to Firestore collection named "issues"
      await addIssue(issueData);

      setSubmitSuccess(true);
      setSubmitMessage("Protocol Transmitted Successfully");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error: unknown) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      alert("Submission failed: " + errMsg);
      setSubmitMessage("Submit Report to CivicPulse");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#081425] text-[#d8e3fb] font-sans min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-10 h-16 bg-[#081425] border-b border-[#424754]/50">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-bold text-xl text-[#adc6ff] hover:opacity-90">
            CivicPulse / Community Hero
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-semibold text-[#adc6ff] hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-24 pb-32 px-4 md:px-6">
        <div className="max-w-2xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-6 technical-border pl-4">
            <h1 className="text-2xl md:text-3xl font-bold text-[#d8e3fb]">Submit Governance Report</h1>
            <p className="text-sm text-[#c2c6d6] mt-1">Initialize civic resolution protocol via photographic evidence.</p>
          </div>

          {/* Report Form */}
          <form className="flex flex-col gap-6" id="civic-report-form" onSubmit={handleSubmit}>
            {/* Upload Zone */}
            <div 
              className={`relative glass-panel rounded-xl border-2 border-dashed border-[#424754] p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#adc6ff] transition-all group overflow-hidden ${
                imageUrl ? 'border-emerald-500/50 hover:border-emerald-400' : ''
              } ${isUploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
              onClick={isUploading ? undefined : triggerFileInput}
              onDragOver={handleDragOver}
              onDrop={isUploading ? undefined : handleDrop}
            >
              <div className="absolute inset-0 bg-[#adc6ff]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              {uploadStatus === "idle" && (
                <>
                  <span className="material-symbols-outlined text-4xl text-[#adc6ff] mb-4 group-hover:scale-110 transition-transform">
                    video_camera_back
                  </span>
                  <p className="text-lg font-semibold text-[#d8e3fb]">Click or drag to upload image or video</p>
                  <p className="text-xs text-[#c2c6d6] mt-2 uppercase tracking-wider">Accepted: JPG, PNG, MP4, MOV (Max 24MB)</p>
                </>
              )}

              {(uploadStatus === "uploading" || uploadStatus === "analyzing") && (
                <>
                  <span className="material-symbols-outlined text-4xl text-[#adc6ff] mb-4 animate-spin">
                    sync
                  </span>
                  <p className="text-lg font-semibold text-[#d8e3fb]">{progressMessage}</p>
                </>
              )}

              {uploadStatus === "success" && (
                <>
                  <span className="material-symbols-outlined text-4xl text-emerald-400 mb-4">
                    check_circle
                  </span>
                  <p className="text-lg font-semibold text-emerald-400">{progressMessage}</p>
                  {imageUrl && (
                    <div className="mt-4 max-w-xs h-32 rounded-lg overflow-hidden border border-[#424754] shadow-inner">
                      {imageFile?.type.startsWith("video/") ? (
                        <video src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover" controls />
                      ) : (
                        <img src={imageUrl} alt="Uploaded Asset" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                </>
              )}

              {uploadStatus === "error" && (
                <>
                  <span className="material-symbols-outlined text-4xl text-rose-400 mb-4">
                    error
                  </span>
                  <p className="text-lg font-semibold text-rose-400">Analysis Failed</p>
                  <p className="text-xs text-[#c2c6d6] mt-2">{progressMessage}</p>
                  <p className="text-xs text-[#adc6ff] mt-2 underline">Try uploading another file</p>
                </>
              )}

              <input 
                accept="image/*,video/*" 
                className="hidden" 
                id="file-input" 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            {/* AI Analysis Section */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff] text-sm">auto_awesome</span>
                <h2 className="text-xs font-semibold text-[#adc6ff] uppercase tracking-wider">AI Analysis & Classification</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c2c6d6] uppercase ml-1 tracking-wide">Category</label>
                  <div className="bg-[#111c2d] border border-[#424754] rounded px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#c2c6d6] text-lg">category</span>
                    <input 
                      className="bg-transparent border-none p-0 text-[#d8e3fb] text-sm w-full focus:ring-0 outline-none" 
                      type="text" 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                </div>

                {/* Subcategory */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#c2c6d6] uppercase ml-1 tracking-wide">Subcategory</label>
                  <div className="bg-[#111c2d] border border-[#424754] rounded px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#c2c6d6] text-lg">subdirectory_arrow_right</span>
                    <input 
                      className="bg-transparent border-none p-0 text-[#d8e3fb] text-sm w-full focus:ring-0 outline-none" 
                      type="text" 
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                    />
                  </div>
                </div>

                {/* Severity */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs text-[#c2c6d6] uppercase ml-1 tracking-wide">Severity Assessment</label>
                  <div className="bg-[#111c2d] border border-[#424754] rounded px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 w-full">
                      <span className="material-symbols-outlined text-rose-400 text-lg">warning</span>
                      <input 
                        className="bg-transparent border-none p-0 text-[#d8e3fb] text-sm w-full focus:ring-0 outline-none" 
                        type="text" 
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded border border-rose-500/30 whitespace-nowrap">
                      {severity.toUpperCase().includes("LEVEL") ? severity : `LEVEL: ${severity}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Short Summary */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#c2c6d6] uppercase ml-1 tracking-wide">Technical Summary</label>
                <div className="bg-[#111c2d] border border-[#424754] rounded p-4">
                  <textarea 
                    className="bg-transparent border-none p-0 text-[#d8e3fb] text-sm w-full focus:ring-0 resize-none outline-none" 
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>
              </div>

              {/* Geolocation and Mapping Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#adc6ff] text-sm">location_on</span>
                    <h2 className="text-xs font-semibold text-[#adc6ff] uppercase tracking-wider">Geolocation Coordinates</h2>
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isLocating}
                    className="px-4 py-2 bg-[#0057ff] hover:bg-[#004ce0] border border-[#0078ff] rounded text-xs font-semibold text-white flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-[0_0_16px_rgba(0,120,255,0.5)]"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isLocating ? 'animate-spin' : ''}`}>
                      {isLocating ? 'sync' : 'my_location'}
                    </span>
                    <span>{isLocating ? "Detecting..." : "Detect GPS"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111c2d] border border-[#424754] rounded px-4 py-2 text-xs">
                    <span className="text-[9px] font-mono text-[#c2c6d6] block uppercase">LATITUDE</span>
                    <span className="font-mono text-[#d8e3fb] text-sm mt-0.5 block">{latitude.toFixed(6)}</span>
                  </div>
                  <div className="bg-[#111c2d] border border-[#424754] rounded px-4 py-2 text-xs">
                    <span className="text-[9px] font-mono text-[#c2c6d6] block uppercase">LONGITUDE</span>
                    <span className="font-mono text-[#d8e3fb] text-sm mt-0.5 block">{longitude.toFixed(6)}</span>
                  </div>
                </div>

                <div className="h-48 w-full rounded-lg overflow-hidden border border-[#424754] relative">
                  <ReportMapSelector 
                    latitude={latitude}
                    longitude={longitude}
                    onChangeLocation={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                  />
                </div>
                <p className="text-[10px] text-[#c2c6d6] italic text-center">
                  Drag the marker or click on the map to manually refine coordinates.
                </p>
              </div>
            </section>

            {/* Data Privacy Protocol */}
            <div className="p-4 bg-[#152031] rounded-lg border border-[#424754]/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#adc6ff] mt-0.5">verified_user</span>
              <p className="text-xs text-[#c2c6d6] leading-relaxed">
                Your location and metadata are automatically encrypted using Governance Standard AES-256 before transmission to the central civic node.
              </p>
            </div>
          </form>
        </div>
      </main>

      {/* Bottom Action Bar / Submit */}
      <div className="fixed bottom-0 left-0 w-full z-40 bg-[#111c2d] border-t border-[#424754] px-4 py-4 md:px-10">
        <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-4 items-center">
          <button 
            className={`w-full text-md py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              submitSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-[#4d8eff] text-[#00285d] hover:bg-[#4d8eff]/90'
            }`} 
            form="civic-report-form" 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined">send</span>
            )}
            {submitMessage}
          </button>
        </div>
      </div>
    </div>
  );
}
