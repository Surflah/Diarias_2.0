// frontend/src/components/PlacesAutocomplete.tsx

import React from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
import { TextField, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';

interface PlaceSelection {
  description: string;
  placeId?: string;
  addressComponents?: google.maps.GeocoderAddressComponent[];
  latLng?: { lat: number; lng: number };
}

interface PlacesAutocompleteProps {
  // agora retorna um objeto com mais detalhes (address components, latlng, placeId)
  onSelect: (selection: PlaceSelection) => void;
}

export const PlacesAutocomplete = ({ onSelect }: PlacesAutocompleteProps) => {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'br' }, // Restringe a busca ao Brasil
    },
    debounce: 300,
  });

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleSelect = (suggestion: google.maps.places.AutocompletePrediction) => async () => {
    // mostra o texto selecionado no input
    setValue(suggestion.description, false);
    clearSuggestions();

    try {
      // tenta obter detalhes de geocode (address_components) a partir do place_id quando disponível
      const placeId = suggestion.place_id;
      let geocodeResults: google.maps.GeocoderResult[] | undefined;
      if (placeId) {
        geocodeResults = await getGeocode({ placeId });
      }
      // fallback: tentar obter geocode por address string
      if ((!geocodeResults || geocodeResults.length === 0) && suggestion.description) {
        geocodeResults = await getGeocode({ address: suggestion.description });
      }

      const addressComponents = geocodeResults && geocodeResults[0] ? geocodeResults[0].address_components : undefined;
      let latLng;
      if (geocodeResults && geocodeResults[0]) {
        try {
          latLng = await getLatLng(geocodeResults[0]);
        } catch (err) {
          // ignore latlng error
          latLng = undefined;
        }
      }

      onSelect({
        description: suggestion.description,
        placeId: placeId,
        addressComponents,
        latLng,
      });
    } catch (err) {
      // se algo deu errado, ainda retorna a descrição (útil)
      onSelect({ description: suggestion.description, placeId: suggestion.place_id });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <TextField
        value={value}
        onChange={handleInput}
        disabled={!ready}
        label="Local de Destino"
        placeholder="Digite o nome da cidade..."
        fullWidth
        required
      />
      {status === 'OK' && (
        <Paper
          elevation={4}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: '4px'
          }}
        >
          <List>
            {data.map((suggestion) => {
              const {
                place_id,
                structured_formatting: { main_text, secondary_text },
              } = suggestion;
              return (
                <ListItem key={place_id} component="div" onClick={handleSelect(suggestion)} style={{ cursor: 'pointer' }}>
                  <ListItemText
                    primary={<Typography variant="body1">{main_text}</Typography>}
                    secondary={<Typography variant="body2" color="text.secondary">{secondary_text}</Typography>}
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
