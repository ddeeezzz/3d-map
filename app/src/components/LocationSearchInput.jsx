// app/src/components/LocationSearchInput.jsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import "./LocationSearchInput.css";
import { getPoiRecords } from "../lib/poiIndex";

const MAX_SUGGESTIONS = 7;

function resolvePoiSource(externalPoiList) {
  if (Array.isArray(externalPoiList) && externalPoiList.length > 0) {
    return externalPoiList;
  }
  return getPoiRecords();
}

const LocationSearchInput = ({
  placeholder,
  onSelectLocation,
  selectedLocation,
  onClearLocation,
  poiList,
}) => {
  const allPois = useMemo(() => resolvePoiSource(poiList), [poiList]);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchTerm.length > 0 && isFocused) {
      const lowerCaseTerm = searchTerm.toLowerCase();
      const filtered = allPois
        .filter((poi) => {
          const poiName = poi?.name?.trim();
          if (!poiName) {
            return false;
          }
          return poiName.toLowerCase().includes(lowerCaseTerm);
        })
        .slice(0, MAX_SUGGESTIONS);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, isFocused, allPois]);

  const handleSelect = (poi) => {
    if (typeof onSelectLocation === "function") {
      const enhancedPoi = {
        ...poi,
        id: poi.poiId ?? poi.id,
        position: poi.position ?? {
          x: poi.worldX ?? 0,
          z: poi.worldZ ?? 0,
        },
      };
      onSelectLocation(enhancedPoi);
    }
    setSearchTerm("");
    setSuggestions([]);
    inputRef.current?.blur();
  };

  if (selectedLocation) {
    return (
      <div className="selected-location-display">
        <span>{selectedLocation.name}</span>
        <button onClick={onClearLocation} className="clear-button">
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="search-input-wrapper">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((poi) => (
            <li key={poi.poiId} onMouseDown={() => handleSelect(poi)}>
              {poi.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearchInput;