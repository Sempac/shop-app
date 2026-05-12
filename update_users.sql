-- Supprimer les anciens utilisateurs
DELETE FROM app_users;

-- Gerants et vendeurs avec PIN 0000 et password Password
INSERT INTO app_users (name, role, auth_type, pin, password_hash) VALUES
('Kader',   'gerant',  'pin', '0000', 'Password'),
('Hacene',  'gerant',  'pin', '0000', 'Password'),
('Ramdane', 'gerant',  'pin', '0000', 'Password'),
('Idriss',  'vendeur', 'pin', '0000', 'Password'),
('Rafik',   'vendeur', 'pin', '0000', 'Password');

SELECT id, name, role FROM app_users ORDER BY role DESC, name ASC;
