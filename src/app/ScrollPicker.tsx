'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Assuming global.css is imported elsewhere or is truly global
// import './global.css'; // Keep if needed locally

export interface ScrollPickerProps {
  options: string[];
  placeholder?: string;
  // Optional: Callback when an option is selected
  onSelect?: (selectedOption: string) => void;
}

/**
 * ScrollPicker Component:
 * - Fixed height (defined in CSS).
 * - Dropdown list fades in/out using CSS transitions.
 * - Closes on option selection or clicking outside.
 * - Toggles open/closed on clicking the main picker area.
 */
const ScrollPicker: React.FC<ScrollPickerProps> = ({
  options,
  placeholder = 'Select...',
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Use useCallback to memoize the handler function
  const handleClickOutside = useCallback((event: MouseEvent) => {
    // Close if clicked outside the component and it's currently open
    if (
      isOpen &&
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, [isOpen]); // Recreate only if isOpen changes

  useEffect(() => {
    // Add listener when component mounts or isOpen changes
    document.addEventListener('mousedown', handleClickOutside);
    // Cleanup listener when component unmounts or handler changes
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]); // Dependency is the memoized handler

  const handleSelectOption = (option: string) => {
    setSelected(option);
    setIsOpen(false); // Close the dropdown
    if (onSelect) {
      onSelect(option); // Call the callback if provided
    }
  };

  // Toggle dropdown visibility when the container is clicked
  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      // Add 'expanded' class when open for CSS targeting
      className={`scroll-picker-container ${isOpen ? 'expanded' : ''}`}
      onClick={handleToggleOpen} // Use toggle handler
      // Optional ARIA attributes for better accessibility
      role="listbox"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      tabIndex={0} // Make it focusable
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleOpen() }} // Allow opening with keyboard
    >
      {/* Displayed text */}
      <div className="scroll-picker-text">
        {selected || placeholder}
      </div>

      {/* List: Visibility and fade controlled by CSS via '.expanded' on parent */}
      <ul className="scroll-picker-list">
        {options.map((option) => (
          <li
            key={option}
            onClick={(e) => {
              // Prevent the container's toggle handler from firing
              e.stopPropagation();
              handleSelectOption(option);
            }}
            // Optional ARIA for accessibility
            role="option"
            aria-selected={selected === option}
            // Basic keyboard nav (could be enhanced)
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelectOption(option); } }}
             tabIndex={isOpen ? 0 : -1} // Only tabbable when open
          >
            {option}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScrollPicker;