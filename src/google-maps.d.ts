declare namespace google {
  namespace maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface Icon {
      url?: string;
      scaledSize?: Size;
      anchor?: Point;
      labelOrigin?: Point;
    }

    class Point {
      constructor(x: number, y: number);
    }

    class Size {
      constructor(width: number, height: number);
    }

    class LatLngBounds {
      extend(latLng: LatLngLiteral): void;
      getCenter(): LatLngLiteral;
    }

    class Map {
      constructor(element: Element, options?: Record<string, unknown>);
      fitBounds(bounds: LatLngBounds, padding?: number): void;
      setCenter(latLng: LatLngLiteral): void;
      setZoom(zoom: number): void;
    }

    namespace event {
      function trigger(instance: unknown, eventName: string): void;
    }

    const Animation: {
      DROP: unknown;
    };

    class Marker {
      constructor(options?: Record<string, unknown>);
      addListener(eventName: string, handler: () => void): void;
      setMap(map: Map | null): void;
    }

    class InfoWindow {
      constructor(options?: Record<string, unknown>);
      open(options?: Record<string, unknown>): void;
      close(): void;
    }
  }
}
