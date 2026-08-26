-- Phase 9a: add RETURN inventory movement type (must commit before use)
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'RETURN';
