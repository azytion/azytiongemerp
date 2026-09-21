-- Database is selected by active connection

INSERT IGNORE INTO users (username, password_hash, role, pin) VALUES
  ('admin', '$2b$10$WUddbUAF1a36sLILVhKQz.pjJY1Yl.Vdz3JB8gddRcQ1mZwjciYKG', 'admin', '1234'),
  ('manager', '$2b$10$f6xJmpm0f2RumcgTvKalr.0PlQB2eiG6/TeCWnFFKOrQs.Qx0xD1y', 'manager', '4321'),
  ('cashier', '$2b$10$UOZd8I.ht71RrNOBpA3/ZuOYujS2I/rETHi3dJ9yN7awF0/omWIVK', 'cashier', '0000');
