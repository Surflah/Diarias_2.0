// frontend/src/components/PlacesAutocomplete.tsx

import React from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
import { TextField, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';

interface PlacesAutocompleteProps {
  onSelect: (address: string) => void;
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

  const handleSelect = (suggestion: google.maps.places.AutocompletePrediction) => () => {
    setValue(suggestion.description, false);
    clearSuggestions();
    onSelect(suggestion.description);
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