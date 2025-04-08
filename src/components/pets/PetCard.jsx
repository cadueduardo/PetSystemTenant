import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const PetCard = ({ pet, storeParam }) => {
  const navigate = useNavigate();

  const handleView = useCallback(() => {
    navigate(`/tenant/pet/${pet.id}?store=${storeParam}`);
  }, [navigate, pet.id, storeParam]);

  return (
    <div>
      {/* Render your pet card content here */}
    </div>
  );
};

export default PetCard; 