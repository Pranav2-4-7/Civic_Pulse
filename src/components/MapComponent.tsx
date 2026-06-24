"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Issue } from "@/lib/firebase";

interface MapComponentProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
}

export default function MapComponent({ issues, onSelectIssue }: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center around Bangalore average or first issue
    const centerLat = issues.length > 0 ? issues[0].location.latitude : 12.9716;
    const centerLng = issues.length > 0 ? issues[0].location.longitude : 77.5946;

    // Leaflet map creation
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    // Dark Map tiles (OSM tiles inverted in CSS filter)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Zoom controls at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    issues.forEach((issue) => {
      const { latitude, longitude } = issue.location;
      if (!latitude || !longitude) return;

      const isHigh = issue.severity.toLowerCase().includes("high") || 
                     issue.severity.toLowerCase().includes("critical") ||
                     issue.severity.includes("4") || 
                     issue.severity.includes("3");

      const icon = L.divIcon({
        className: "custom-map-pin-div",
        html: `
          <div class="relative cursor-pointer -translate-x-1/2 -translate-y-full">
            <div class="w-7 h-7 rounded-full border-2 border-[#10131a] flex items-center justify-center transition-transform hover:scale-110 ${
              isHigh 
                ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] text-white animate-pulse' 
                : 'bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] text-black'
            }">
              <span class="text-[10px] font-bold font-mono">!</span>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-[#10131a] ${
              isHigh ? 'bg-rose-500' : 'bg-[#00f0ff]'
            }"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [0, 0] // Anchor matches translation in HTML
      });

      const marker = L.marker([latitude, longitude], { icon })
        .addTo(map)
        .on("click", () => {
          onSelectIssue(issue);
        });

      // Interactive Popup
      marker.bindPopup(`
        <div class="p-1 font-sans text-xs">
          <p class="font-bold text-[#00f0ff] font-mono m-0">${issue.subcategory}</p>
          <p class="text-[10px] text-[#b9cacb] m-0 mt-0.5">${issue.location.grid}</p>
          <p class="text-[9px] font-bold font-mono uppercase m-0 mt-1 ${isHigh ? 'text-rose-400' : 'text-[#2ae500]'}">${issue.severity}</p>
        </div>
      `, {
        closeButton: false,
        offset: [0, -25]
      });

      markersRef.current.push(marker);
    });
  }, [issues, onSelectIssue]);

  return <div ref={mapContainerRef} className="w-full h-full relative z-10" />;
}
