import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { GeoZoneMapPicker } from './GeoZoneMapPicker';
import * as maplibregl from 'maplibre-gl';
import { geocodingService } from '../services/geocoding.service';
import { MAP_STYLE_URL, DEFAULT_MAP_ZOOM } from '../constants/map.config';

let mapEventHandlers: Record<string, Function[]> = {};
let markerEventHandlers: Record<string, Function[]> = {};

const mockSource = {
  setData: vi.fn(),
};

const mockMarker = {
  setLngLat: vi.fn().mockImplementation(function (this: any) {
    return this;
  }),
  setDraggable: vi.fn().mockImplementation(function (this: any) {
    return this;
  }),
  addTo: vi.fn().mockImplementation(function (this: any) {
    return this;
  }),
  remove: vi.fn(),
  getLngLat: vi.fn().mockReturnValue({ lng: 73.8567, lat: 18.5204 }),
  on: vi.fn().mockImplementation(function (this: any, event: string, handler: Function) {
    if (!markerEventHandlers[event]) markerEventHandlers[event] = [];
    markerEventHandlers[event].push(handler);
    return this;
  }),
};

const mockMap = {
  addControl: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: vi.fn().mockReturnValue(mockSource),
  setCenter: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  remove: vi.fn(),
  resize: vi.fn(),
  loaded: vi.fn().mockReturnValue(true),
  isStyleLoaded: vi.fn().mockReturnValue(true),
  on: vi.fn().mockImplementation(function (this: any, event: string, handler: Function) {
    if (!mapEventHandlers[event]) mapEventHandlers[event] = [];
    mapEventHandlers[event].push(handler);
    if (event === 'load') {
      handler();
    }
    return this;
  }),
  once: vi.fn().mockImplementation(function (this: any, event: string, handler: Function) {
    if (!mapEventHandlers[event]) mapEventHandlers[event] = [];
    mapEventHandlers[event].push(handler);
    return this;
  }),
};

vi.mock('maplibre-gl', () => {
  const MapConstructor = vi.fn().mockImplementation(function (this: any) {
    return mockMap;
  });

  const MarkerConstructor = vi.fn().mockImplementation(function (this: any) {
    return mockMarker;
  });

  const NavigationControlConstructor = vi.fn().mockImplementation(function (this: any) {
    return {};
  });

  return {
    default: {
      Map: MapConstructor,
      Marker: MarkerConstructor,
      NavigationControl: NavigationControlConstructor,
    },
    Map: MapConstructor,
    Marker: MarkerConstructor,
    NavigationControl: NavigationControlConstructor,
  };
});

vi.mock('../services/geocoding.service', () => ({
  geocodingService: {
    searchAddress: vi.fn(),
  },
}));

describe('GeoZoneMapPicker - MapLibre + OpenFreeMap Bright Forensic Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(mapEventHandlers)) delete mapEventHandlers[k];
    for (const k of Object.keys(markerEventHandlers)) delete markerEventHandlers[k];

    // Emulate non-zero rendered container dimensions in JSDOM
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 300,
    });
  });

  it('1. MapLibre initialization: Initializes map with OpenFreeMap Bright style at native zoom (14) with maxZoom (19)', () => {
    const handleLocationChange = vi.fn();

    render(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={200}
        onLocationChange={handleLocationChange}
      />,
    );

    const container = screen.getByTestId('maplibre-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveStyle({ minHeight: '280px', width: '100%', height: '100%' });
    expect(maplibregl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        style: MAP_STYLE_URL,
        center: [73.8567, 18.5204],
        zoom: DEFAULT_MAP_ZOOM,
        maxZoom: 19,
        attributionControl: { compact: true },
      }),
    );
    expect(mockMap.resize).toHaveBeenCalled();
    expect(maplibregl.Marker).toHaveBeenCalledWith(
      expect.objectContaining({
        draggable: true,
        color: '#2563EB',
      }),
    );
  });

  it('2. Marker movement → coordinates update: Dragging marker updates form coordinates in [latitude, longitude] format', () => {
    const handleLocationChange = vi.fn();

    render(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    // Mock new position on dragend
    mockMarker.getLngLat.mockReturnValue({
      lng: 73.86123456,
      lat: 18.52451234,
    });

    const dragEndHandler = markerEventHandlers['dragend']?.[0];
    expect(dragEndHandler).toBeDefined();

    act(() => {
      dragEndHandler();
    });

    expect(handleLocationChange).toHaveBeenCalledWith(18.524512, 73.861235);
  });

  it('3. Map click → coordinates update: Clicking map updates marker and passes new coordinates to form', () => {
    const handleLocationChange = vi.fn();

    render(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    const clickHandler = mapEventHandlers['click']?.[0];
    expect(clickHandler).toBeDefined();

    act(() => {
      clickHandler({
        lngLat: {
          lng: 73.870000,
          lat: 18.530000,
        },
      });
    });

    expect(handleLocationChange).toHaveBeenCalledWith(18.53, 73.87);
  });

  it('4. Radius change → circle update: Updating radiusMeters updates the MapLibre GeoJSON circle and calls fitBounds', () => {
    const handleLocationChange = vi.fn();

    const { rerender } = render(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Feature',
        properties: { radiusMeters: 150 },
      }),
    );

    // Re-render with new radius
    rerender(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={450}
        onLocationChange={handleLocationChange}
      />,
    );

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Feature',
        properties: { radiusMeters: 450 },
      }),
    );
    expect(mockMap.fitBounds).toHaveBeenCalled();
  });

  it('5. User-Triggered Address Search: Typing does NOT trigger geocoding until explicit search action', async () => {
    const handleLocationChange = vi.fn();
    (geocodingService.searchAddress as any).mockResolvedValueOnce([
      {
        displayName: 'Acme Tower, MG Road, Pune, Maharashtra, 411001, India',
        latitude: 18.51957,
        longitude: 73.85535,
        placeId: '101',
      },
    ]);

    render(
      <GeoZoneMapPicker
        latitude=""
        longitude=""
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    const searchInput = screen.getByTestId('geozone-search-input');

    // User types in search bar
    fireEvent.change(searchInput, { target: { value: 'Acme Tower Pune' } });

    // Assert NO geocoding request is fired while typing
    expect(geocodingService.searchAddress).not.toHaveBeenCalled();

    // User explicitly clicks Search button
    const searchBtn = screen.getByTestId('geozone-search-submit');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(geocodingService.searchAddress).toHaveBeenCalledWith('Acme Tower Pune');
    });

    // Select result from dropdown
    const resultItem = await screen.findByText(/Acme Tower, MG Road/i);
    fireEvent.click(resultItem);

    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [73.85535, 18.51957],
        zoom: DEFAULT_MAP_ZOOM,
      }),
    );
    expect(handleLocationChange).toHaveBeenCalledWith(
      18.51957,
      73.85535,
      'Acme Tower, MG Road, Pune, Maharashtra, 411001, India',
    );
  });

  it('6. Search Error Handling: Handles Nominatim failure or rate limiting gracefully', async () => {
    const handleLocationChange = vi.fn();
    (geocodingService.searchAddress as any).mockRejectedValueOnce(
      new Error('Search rate limit reached. Please wait a few seconds before retrying.'),
    );

    render(
      <GeoZoneMapPicker
        latitude=""
        longitude=""
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    const searchInput = screen.getByTestId('geozone-search-input');
    fireEvent.change(searchInput, { target: { value: 'Bangalore Office' } });

    // Press Enter to trigger search
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(
        screen.getByText(/Search rate limit reached/i),
      ).toBeInTheDocument();
    });
  });

  it('7. "Use My Location": Retrieves current GPS position and updates coordinates', () => {
    const handleLocationChange = vi.fn();

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementationOnce((success) =>
        success({
          coords: {
            latitude: 19.0760,
            longitude: 72.8777,
            accuracy: 10,
          },
        }),
      ),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    render(
      <GeoZoneMapPicker
        latitude=""
        longitude=""
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    const locateBtn = screen.getByRole('button', { name: /Use My Location/i });
    fireEvent.click(locateBtn);

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [72.8777, 19.076],
        zoom: DEFAULT_MAP_ZOOM,
      }),
    );
    expect(handleLocationChange).toHaveBeenCalledWith(19.076, 72.8777);
  });

  it('8. Zero Google Maps dependency: Confirms zero Google Maps globals or keys are expected or required', () => {
    expect((window as any).google).toBeUndefined();
    expect(import.meta.env.VITE_GOOGLE_MAPS_API_KEY).toBeUndefined();
  });

  it('9. MapLibre cleanup lifecycle: Calls remove on Map and Marker on component unmount', () => {
    const handleLocationChange = vi.fn();

    const { unmount } = render(
      <GeoZoneMapPicker
        latitude={18.5204}
        longitude={73.8567}
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    unmount();

    expect(mockMarker.remove).toHaveBeenCalled();
    expect(mockMap.remove).toHaveBeenCalled();
  });

  it('10. Container Inline Dimensions: Outer and inner containers enforce explicit minimum dimensions', () => {
    const handleLocationChange = vi.fn();

    render(
      <GeoZoneMapPicker
        latitude=""
        longitude=""
        radiusMeters={150}
        onLocationChange={handleLocationChange}
      />,
    );

    const container = screen.getByTestId('maplibre-container');
    expect(container).toHaveStyle({ minHeight: '280px', width: '100%', height: '100%' });
  });
});
