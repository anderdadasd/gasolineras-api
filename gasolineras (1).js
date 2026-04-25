// api/gasolineras.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lon, radio = 15 } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Faltan parámetros lat y lon' });
  }

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radioKm = parseFloat(radio);

  try {
    const response = await fetch(
      'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) throw new Error('Error al consultar el Ministerio');

    const data = await response.json();
    const estaciones = data.ListaEESSPrecio;

    function haversine(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const cercanas = estaciones
      .filter((s) => {
        const precioStr = s['Precio Gasoleo A'];
        if (!precioStr || precioStr.trim() === '') return false;
        const sLat = parseFloat(s.Latitud.replace(',', '.'));
        const sLon = parseFloat(s['Longitud (WGS84)'].replace(',', '.'));
        if (isNaN(sLat) || isNaN(sLon)) return false;
        return haversine(userLat, userLon, sLat, sLon) <= radioKm;
      })
      .map((s) => {
        const sLat = parseFloat(s.Latitud.replace(',', '.'));
        const sLon = parseFloat(s['Longitud (WGS84)'].replace(',', '.'));
        return {
          nombre: s['Rótulo'].trim(),
          direccion: s['Dirección'].trim(),
          municipio: s.Municipio.trim(),
          precio: parseFloat(s['Precio Gasoleo A'].replace(',', '.')),
          distancia: Math.round(haversine(userLat, userLon, sLat, sLon) * 10) / 10,
        };
      })
      .sort((a, b) => a.precio - b.precio)
      .slice(0, 10);

    const notificacion = cercanas
      .map(
        (g, i) =>
          `${i + 1}. ${g.nombre} — ${g.precio.toFixed(3)} €/L (${g.distancia} km)\n   ${g.municipio}`
      )
      .join('\n');

    return res.status(200).json({
      total: cercanas.length,
      radio_km: radioKm,
      gasolineras: cercanas,
      notificacion: notificacion || 'No se encontraron gasolineras en el radio indicado.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
