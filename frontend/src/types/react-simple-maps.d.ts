declare module "react-simple-maps" {
  import * as React from "react";
  import { GeoProjection } from "d3-geo";

  export interface ComposableMapProps {
    projection?: string | ((width: number, height: number, config: any) => GeoProjection) | GeoProjection;
    projectionConfig?: any;
    width?: number;
    height?: number;
    viewBox?: string;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;

  export interface GeographyProps {
    geography: any;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: any;
    onClick?: (e: React.MouseEvent) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    className?: string;
  }

  export const Geography: React.FC<GeographyProps>;

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: any[] }) => React.ReactNode;
    parseGeographies?: (geos: any[]) => any[];
  }

  export const Geographies: React.FC<GeographiesProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
  }

  export const Marker: React.FC<MarkerProps>;

  export interface ZoomableGroupProps {
    children?: React.ReactNode;
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveStart?: (event: any, props: any) => void;
    onMove?: (event: any, props: any) => void;
    onMoveEnd?: (event: any, props: any) => void;
    className?: string;
    style?: React.CSSProperties;
  }

  export const ZoomableGroup: React.FC<ZoomableGroupProps>;
}
