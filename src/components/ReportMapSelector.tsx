"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface ReportMapSelectorProps {
  latitude: number;
  longitude: number;
  onChangeLocation: (lat: number, lng: number) => void;
}

export default function ReportMapSelector({ latitude, longitude, onChangeLocation }: ReportMapSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Leaflet map centered at selected location
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 14,
      zoomControl: false,
    });
    mapRef.current = map;

    // Dark Map tiles (OSM tiles inverted in CSS filter)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Create custom pin icon
    const icon = L.divIcon({
      className: "custom-map-pin-selector",
      html: `
        <div class="relative cursor-pointer -translate-x-1/2 -translate-y-full">
          <div class="w-8 h-8 rounded-full border-2 border-[#10131a] bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] flex items-center justify-center">
            <span class="material-symbols-outlined text-black text-[18px]">location_searching</span>
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-[#00f0ff] border-r border-b border-[#10131a]"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [0, 0]
    });

    // Create draggable marker
    const marker = L.marker([latitude, longitude], { 
      icon, 
      draggable: true 
    }).addTo(map);
    markerRef.current = marker;

    // Marker drag end event
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      onChangeLocation(position.lat, position.lng);
    });

    // Map click event
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      onChangeLocation(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update map center and marker when coords change from outer buttons (e.g. Geolocation detect)
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      const currentPos = marker.getLatLng();
      if (currentPos.lat !== latitude || currentPos.lng !== longitude) {
        marker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude], map.getZoom());
      }
    }
  }, [latitude, longitude]);

  return <div ref={mapContainerRef} className="w-full h-full relative z-10" />;
}
