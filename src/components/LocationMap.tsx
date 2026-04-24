import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export type MapMarker = {
  lat: number
  lng: number
  label?: string
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15)
      return
    }
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, markers])
  return null
}

type Props =
  | { lat: number; lng: number; label?: string; markers?: never; height?: number }
  | { markers: MapMarker[]; lat?: never; lng?: never; label?: never; height?: number }

export default function LocationMap(props: Props) {
  const { height = 200 } = props
  const markers: MapMarker[] = props.markers
    ? props.markers
    : [{ lat: props.lat!, lng: props.lng!, label: props.label }]

  if (markers.length === 0) return null

  const center: [number, number] = [markers[0].lat, markers[0].lng]

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-700" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <FitBounds markers={markers} />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={icon}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
