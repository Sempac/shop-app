--
-- PostgreSQL database dump
--

\restrict walcDpqYcrjNk6r143pWALw3gRQFpeLRDrpzlJmviB2PoM92ItPMsTj3fkXcLS3

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, category, purchase_price, sale_price, stock_quantity, supplier_id, barcode, condition, stock_alert, location_zone, location_detail, color, supplier_name, grade) FROM stdin;
72	MacBook Air M1 8Go 256Go	PC Portable	700.00	1099.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
73	MacBook Air M2 8Go 256Go	PC Portable	850.00	1299.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
74	MacBook Air M2 8Go 512Go	PC Portable	950.00	1499.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
75	MacBook Pro M3 14" 512Go	PC Portable	1300.00	1999.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
76	MacBook Pro M3 16" 512Go	PC Portable	1600.00	2499.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
77	Dell XPS 13 i7 512Go	PC Portable	700.00	1099.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
78	Dell Inspiron 15 i5 256Go	PC Portable	400.00	649.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
79	Dell Inspiron 15 i7 512Go	PC Portable	550.00	849.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
42	Samsung Galaxy A55 128Go	Smartphone	220.00	369.00	1	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
80	HP EliteBook 840 i5	PC Portable	450.00	699.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
81	HP Pavilion 15 i5 512Go	PC Portable	400.00	649.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
82	HP Spectre x360 i7	PC Portable	800.00	1249.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
83	Lenovo ThinkPad X1 i7	PC Portable	700.00	1099.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
84	Lenovo IdeaPad 5 i5 512Go	PC Portable	400.00	649.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
68	Samsung Galaxy Tab S9	Tablette	500.00	799.00	0	\N	\N	RECONDITIONNE	5	\N	\N	Jaune	LOT	\N
5	iPhone 7 128Go	Smartphone	90.00	169.00	0	\N	\N	OCCASION	5	\N	\N	Noir	LOT	\N
85	Asus ZenBook 14 i7	PC Portable	550.00	849.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
86	Microsoft Surface Pro 9	PC Portable	800.00	1249.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
2	Samsung S21	Smartphone	180.00	300.00	82	2	22222222	OCCASION	3	\N	\N	Bleu marine	lot	\N
17	iPhone 11 Pro 256Go	Smartphone	320.00	529.00	-3	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
15	iPhone 11 128Go	Smartphone	240.00	399.00	-1	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
4	iPhone 7 64Go	Smartphone	80.00	149.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
6	iPhone 8 64Go	Smartphone	100.00	189.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
53	Xiaomi 14 256Go	Smartphone	500.00	799.00	0	\N	\N	NEUF	5	\N	\N	Argent	\N	\N
7	iPhone 8 128Go	Smartphone	110.00	209.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
8	iPhone X 64Go	Smartphone	150.00	269.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
9	iPhone X 256Go	Smartphone	170.00	299.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
10	iPhone XR 64Go	Smartphone	160.00	279.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
11	iPhone XR 128Go	Smartphone	175.00	299.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
12	iPhone XS 64Go	Smartphone	200.00	349.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
266	Carte SIM Bouygues	Carte SIM	1.00	5.00	4	\N	\N	NEUF	10	\N	\N	\N	\N	\N
264	Carte SIM SFR	Carte SIM	1.00	5.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
271	Recharge Lebara 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
269	Recharge Free Mobile 10€	Carte SIM	8.00	10.00	18	\N	\N	NEUF	10	\N	\N	\N	\N	\N
268	Recharge Lycamobile 20€	Carte SIM	18.00	20.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
273	Recharge SFR 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
13	iPhone XS 256Go	Smartphone	220.00	379.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
16	iPhone 11 Pro 64Go	Smartphone	280.00	449.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
1	iPhone 11	\N	\N	250.00	-5	1	11111111	NEUF	3	\N	\N	\N	\N	\N
274	Carte SIM Lycamobile	Carte SIM	1.00	3.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
275	Carte SIM Free Mobile	Carte SIM	1.00	3.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
18	iPhone 12 64Go	Smartphone	300.00	479.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
60	iPad 10ème génération 64Go	Tablette	250.00	399.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
14	iPhone 11 64Go	Smartphone	220.00	369.00	0	\N	\N	RECONDITIONNE	5	\N	\N	Noir	\N	Grade A+
3	AirPods	Smartphone	0.00	120.00	7	3	33333333	NEUF	5	Vitrine 1	Colonne 1 Rangée 1	\N	\N	\N
54	Huawei P30 Lite	Smartphone	100.00	179.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
61	iPad Air 5 64Go	Tablette	350.00	549.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
62	iPad Air 5 256Go	Tablette	420.00	649.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
63	iPad Pro 11" 128Go	Tablette	550.00	849.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
64	iPad Pro 12.9" 128Go	Tablette	700.00	1049.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
65	iPad Mini 6 64Go	Tablette	350.00	549.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
66	Samsung Galaxy Tab A8	Tablette	130.00	229.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
67	Samsung Galaxy Tab A9+	Tablette	200.00	329.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
69	Samsung Galaxy Tab S9 Ultra	Tablette	800.00	1199.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
70	Lenovo Tab M10 Plus	Tablette	120.00	199.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
71	Huawei MatePad 11	Tablette	220.00	349.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
276	Carte SIM Lebara	Carte SIM	1.00	3.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
277	Carte SIM SFR	Carte SIM	1.00	5.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
278	Carte SIM Orange	Carte SIM	1.00	5.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
87	Clavier Bluetooth Apple Magic	Accessoire Info	60.00	99.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
19	iPhone 12 128Go	Smartphone	330.00	519.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
265	Carte SIM Orange	Carte SIM	1.00	5.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
270	Recharge Free Mobile 20€	Carte SIM	18.00	20.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
279	Carte SIM Bouygues	Carte SIM	1.00	5.00	10	\N	\N	NEUF	10	\N	\N	\N	\N	\N
280	Recharge Lycamobile 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
281	Recharge Lycamobile 20€	Carte SIM	18.00	20.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
282	Recharge Free Mobile 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
283	Recharge Free Mobile 20€	Carte SIM	18.00	20.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
284	Recharge Lebara 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
285	Recharge Orange 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
286	Recharge SFR 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
88	Clavier Bluetooth universel	Accessoire Info	15.00	39.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
89	Clavier USB filaire	Accessoire Info	8.00	22.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
90	Clavier mécanique gaming	Accessoire Info	40.00	79.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
91	Souris Apple Magic Mouse	Accessoire Info	50.00	89.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
92	Souris Bluetooth sans fil	Accessoire Info	10.00	29.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
20	iPhone 12 Pro 128Go	Smartphone	400.00	629.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
58	Google Pixel 8 Pro 128Go	Smartphone	700.00	1099.00	0	\N	\N	NEUF	5	\N	\N	Bleu	\N	\N
182	Batterie iPhone 12	Pièce détachée	14.00	40.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
115	Coque iPhone 16	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
120	Coque iPad Air 5	Coque	6.00	19.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
272	Recharge Orange 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
267	Recharge Lycamobile 10€	Carte SIM	8.00	10.00	20	\N	\N	NEUF	10	\N	\N	\N	\N	\N
93	Souris USB filaire	Accessoire Info	5.00	15.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
94	Souris gaming RGB	Accessoire Info	20.00	49.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
95	Chargeur MacBook 61W USB-C	Accessoire Info	30.00	69.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
96	Chargeur MacBook 96W USB-C	Accessoire Info	40.00	89.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
97	Chargeur MacBook 140W USB-C	Accessoire Info	50.00	109.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
98	Chargeur Dell 65W	Accessoire Info	20.00	49.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
99	Chargeur HP 65W	Accessoire Info	20.00	49.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
100	Chargeur Lenovo 65W	Accessoire Info	20.00	49.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
101	Chargeur universel PC 90W	Accessoire Info	25.00	59.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
102	Hub USB-C 7 en 1	Accessoire Info	15.00	39.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
103	Disque dur externe 1To	Accessoire Info	35.00	69.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
104	Disque dur externe 2To	Accessoire Info	55.00	99.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
105	Clé USB 32Go	Accessoire Info	4.00	12.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
106	Clé USB 64Go	Accessoire Info	6.00	15.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
107	Clé USB 128Go	Accessoire Info	10.00	22.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
108	Tapis de souris	Accessoire Info	3.00	9.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
109	Support PC portable	Accessoire Info	12.00	29.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
174	Écran iPhone 12 OEM	Pièce détachée	40.00	90.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
175	Écran iPhone 13 OEM	Pièce détachée	50.00	110.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
176	Écran iPhone 14 OEM	Pièce détachée	65.00	140.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
177	Écran iPhone 15 OEM	Pièce détachée	80.00	170.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
178	Écran Samsung A55 OEM	Pièce détachée	45.00	100.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
179	Écran Samsung S24 OEM	Pièce détachée	80.00	170.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
180	Écran Samsung A14 OEM	Pièce détachée	30.00	70.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
183	Batterie iPhone 13	Pièce détachée	16.00	45.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
184	Batterie iPhone 14	Pièce détachée	18.00	50.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
185	Batterie iPhone 15	Pièce détachée	20.00	55.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
186	Batterie Samsung A55	Pièce détachée	12.00	35.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
187	Batterie Samsung S24	Pièce détachée	18.00	50.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
189	Connecteur charge iPhone 12	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
190	Connecteur charge iPhone 13	Pièce détachée	10.00	30.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
191	Connecteur USB-C Samsung	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
193	Haut-parleur iPhone 12	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
194	Haut-parleur iPhone 13	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
195	Haut-parleur iPhone 14	Pièce détachée	9.00	28.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
196	Haut-parleur iPhone 15	Pièce détachée	10.00	30.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
197	Haut-parleur Samsung A55	Pièce détachée	7.00	22.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
198	Haut-parleur Samsung S24	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
199	Haut-parleur Samsung A14	Pièce détachée	6.00	20.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
200	Micro iPhone 11	Pièce détachée	5.00	18.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
201	Micro iPhone 12	Pièce détachée	5.00	18.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
202	Micro iPhone 13	Pièce détachée	6.00	20.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
203	Micro iPhone 14	Pièce détachée	6.00	20.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
204	Micro iPhone 15	Pièce détachée	7.00	22.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
205	Micro Samsung A55	Pièce détachée	5.00	18.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
206	Micro Samsung S24	Pièce détachée	6.00	20.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
207	Micro Samsung A14	Pièce détachée	4.00	15.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
208	Vitre arrière iPhone 12	Pièce détachée	15.00	40.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
209	Vitre arrière iPhone 13	Pièce détachée	18.00	45.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
210	Vitre arrière iPhone 14	Pièce détachée	20.00	50.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
211	Caméra arrière iPhone 12	Pièce détachée	30.00	70.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
212	Caméra arrière iPhone 13	Pièce détachée	40.00	90.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
213	Caméra arrière iPhone 14	Pièce détachée	50.00	110.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
214	Écran iPad 9ème gen	Pièce détachée	60.00	130.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
215	Écran iPad 10ème gen	Pièce détachée	70.00	150.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
216	Écran iPad Air 5	Pièce détachée	90.00	190.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
217	Batterie iPad 9ème gen	Pièce détachée	20.00	55.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
218	Batterie iPad 10ème gen	Pièce détachée	22.00	60.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
219	Batterie Samsung Tab A8	Pièce détachée	18.00	50.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
220	Connecteur charge iPad	Pièce détachée	12.00	35.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
221	Haut-parleur iPad 9ème gen	Pièce détachée	10.00	30.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
222	Micro iPad 10ème gen	Pièce détachée	8.00	25.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
125	Coque portefeuille iPhone	Coque	6.00	22.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
110	Coque iPhone 11	Coque	3.00	12.00	-1	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
111	Coque iPhone 12	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
116	Coque Samsung Galaxy A55	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
121	Coque MacBook Air 13"	Coque	8.00	22.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
261	Carte SIM Lycamobile	Carte SIM	1.00	3.00	9	\N	\N	NEUF	10	\N	\N	\N	\N	\N
263	Carte SIM Lebara	Carte SIM	1.00	3.00	8	\N	\N	NEUF	10	\N	\N	\N	\N	\N
262	Carte SIM Free Mobile	Carte SIM	1.00	3.00	4	\N	\N	NEUF	10	\N	\N	\N	\N	\N
223	Écran MacBook Air 13"	Pièce détachée	150.00	320.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
224	Écran MacBook Pro 14"	Pièce détachée	200.00	420.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
225	Batterie MacBook Air M1	Pièce détachée	60.00	140.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
226	Batterie MacBook Air M2	Pièce détachée	70.00	160.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
39	Samsung Galaxy A14 128Go	Smartphone	95.00	169.00	1	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
227	Batterie MacBook Pro 14"	Pièce détachée	80.00	180.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
228	Clavier MacBook Air 13"	Pièce détachée	80.00	180.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
229	Clavier MacBook Pro 14"	Pièce détachée	100.00	220.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
230	Écran Dell XPS 13	Pièce détachée	120.00	260.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
231	Batterie Dell Inspiron 15	Pièce détachée	35.00	80.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
232	Batterie HP Pavilion 15	Pièce détachée	35.00	80.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
233	Batterie Lenovo IdeaPad	Pièce détachée	35.00	80.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
234	RAM DDR4 8Go	Pièce détachée	20.00	45.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
38	Samsung Galaxy A14 64Go	Smartphone	80.00	149.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
40	Samsung Galaxy A25 128Go	Smartphone	130.00	229.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
43	Samsung Galaxy A55 256Go	Smartphone	250.00	419.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
235	RAM DDR4 16Go	Pièce détachée	35.00	75.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
236	SSD 256Go	Pièce détachée	30.00	65.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
44	Samsung Galaxy S23 128Go	Smartphone	420.00	649.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
126	Coque portefeuille Samsung	Coque	6.00	22.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
112	Coque iPhone 13	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Rouge	\N	\N
117	Coque Samsung Galaxy S24	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Rouge	\N	\N
122	Coque MacBook Pro 14"	Coque	8.00	22.00	0	\N	\N	NEUF	3	\N	\N	Rouge	\N	\N
113	Coque iPhone 14	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Bleu marine	\N	\N
41	Samsung Galaxy A35 128Go	Smartphone	180.00	299.00	0	\N	\N	OCCASION	5	\N	\N	Or	Inconnu	\N
21	iPhone 12 Pro 256Go	Smartphone	440.00	699.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
22	iPhone 13 128Go	Smartphone	420.00	649.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
23	iPhone 13 256Go	Smartphone	460.00	719.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
24	iPhone 13 Pro 128Go	Smartphone	520.00	799.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
25	iPhone 13 Pro 256Go	Smartphone	570.00	879.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
26	iPhone 14 128Go	Smartphone	550.00	849.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
27	iPhone 14 256Go	Smartphone	600.00	929.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
28	iPhone 14 Pro 128Go	Smartphone	700.00	1049.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
29	iPhone 14 Pro 256Go	Smartphone	750.00	1149.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
30	iPhone 15 128Go	Smartphone	700.00	1049.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
31	iPhone 15 256Go	Smartphone	760.00	1149.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
32	iPhone 15 Pro 128Go	Smartphone	850.00	1249.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
33	iPhone 15 Pro 256Go	Smartphone	920.00	1349.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
34	iPhone 16 128Go	Smartphone	900.00	1299.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
35	iPhone 16 256Go	Smartphone	970.00	1399.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
36	iPhone 16 Pro 256Go	Smartphone	1100.00	1599.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
37	iPhone 16 Pro Max 256Go	Smartphone	1200.00	1749.00	0	\N	\N	NEUF	5	\N	\N	Noir	\N	\N
118	Coque Samsung Galaxy A14	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Bleu marine	\N	\N
123	Coque universelle silicone	Coque	2.00	8.00	0	\N	\N	NEUF	3	\N	\N	Bleu marine	\N	\N
114	Coque iPhone 15	Coque	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
119	Coque iPad 10ème gen	Coque	6.00	19.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
124	Coque antichoc renforcée	Coque	5.00	19.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
127	Verre trempé iPhone 11	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
128	Verre trempé iPhone 12	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
57	Google Pixel 8 128Go	Smartphone	500.00	799.00	0	\N	\N	NEUF	5	\N	\N	Bleu	\N	\N
129	Verre trempé iPhone 13	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
130	Verre trempé iPhone 14	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
131	Verre trempé iPhone 15	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
132	Verre trempé iPhone 16	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
133	Verre trempé Samsung A55	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
134	Verre trempé Samsung S24	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
135	Verre trempé Samsung A14	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
136	Verre trempé iPad 10ème gen	Protection écran	4.00	14.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
137	Verre trempé iPad Air 5	Protection écran	4.00	14.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
138	Film hydrogel iPhone 15	Protection écran	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
139	Film hydrogel Samsung S24	Protection écran	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
140	Verre trempé caméra iPhone 15	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
141	Verre trempé caméra iPhone 16	Protection écran	2.00	9.00	0	\N	\N	NEUF	3	\N	\N	Transparent	\N	\N
142	Chargeur Lightning 20W Apple	Chargeur	8.00	25.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
144	Chargeur USB-C 20W	Chargeur	5.00	18.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
150	Chargeur voiture double USB	Chargeur	4.00	15.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
154	Câble USB-C 1m	Câble	3.00	10.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
156	Câble USB-C vers Lightning	Câble	4.00	13.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
158	Câble Micro-USB 1m	Câble	2.00	8.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
160	Câble HDMI 2m	Câble	7.00	19.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
162	Adaptateur Lightning HDMI	Câble	8.00	25.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
146	Chargeur USB-C 65W	Chargeur	12.00	35.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
148	Chargeur MagSafe iPhone 15W	Chargeur	15.00	45.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
143	Chargeur Lightning 20W (compat)	Chargeur	4.00	15.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
145	Chargeur USB-C 30W	Chargeur	7.00	22.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
149	Chargeur voiture USB-C 20W	Chargeur	5.00	18.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
151	Bloc chargeur USB-A 12W	Chargeur	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
153	Câble Lightning 2m	Câble	4.00	13.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
155	Câble USB-C 2m	Câble	4.00	13.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
157	Câble USB-C 100W tressé	Câble	6.00	18.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
159	Câble HDMI 1m	Câble	5.00	15.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
161	Adaptateur USB-C vers HDMI	Câble	6.00	18.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
147	Chargeur sans fil Qi 15W	Chargeur	8.00	25.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
164	AirPods 3ème génération	Audio	90.00	149.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
166	Écouteurs Lightning Apple	Audio	8.00	25.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
168	Écouteurs Jack 3.5mm	Audio	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
170	Casque Bluetooth sans fil	Audio	20.00	59.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
172	Adaptateur Jack USB-C	Audio	3.00	12.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
163	AirPods 2ème génération	Audio	60.00	99.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
165	AirPods Pro 2ème génération	Audio	150.00	249.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
167	Écouteurs USB-C Samsung	Audio	5.00	18.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
169	Écouteurs Bluetooth sport	Audio	12.00	35.00	0	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
171	Adaptateur Jack Lightning	Audio	4.00	14.00	9	\N	\N	NEUF	3	\N	\N	Blanc	\N	\N
55	Huawei P50 Pro	Smartphone	400.00	649.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
56	OnePlus 12 256Go	Smartphone	500.00	799.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
59	iPad 9ème génération 64Go	Tablette	200.00	349.00	0	\N	\N	NEUF	5	\N	\N	\N	\N	\N
152	Câble Lightning 1m	Câble	3.00	10.00	0	\N	\N	NEUF	3	\N	\N	Noir	\N	\N
45	Samsung Galaxy S23 256Go	Smartphone	470.00	729.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
46	Samsung Galaxy S24 128Go	Smartphone	550.00	849.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
47	Samsung Galaxy S24 256Go	Smartphone	600.00	949.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
48	Samsung Galaxy S24 Ultra	Smartphone	900.00	1349.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
49	Samsung Galaxy Z Fold5	Smartphone	1200.00	1799.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
50	Samsung Galaxy Z Flip5	Smartphone	600.00	949.00	0	\N	\N	NEUF	5	\N	\N	Blanc	\N	\N
51	Xiaomi Redmi Note 13 128Go	Smartphone	120.00	199.00	0	\N	\N	NEUF	5	\N	\N	Argent	\N	\N
52	Xiaomi Redmi Note 13 Pro	Smartphone	180.00	299.00	0	\N	\N	NEUF	5	\N	\N	Argent	\N	\N
237	SSD 512Go	Pièce détachée	50.00	99.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
238	SSD 1To	Pièce détachée	80.00	149.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
239	Pâte thermique PC	Pièce détachée	3.00	10.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
240	Ventilateur MacBook Air	Pièce détachée	25.00	60.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
241	Ventilateur Dell Inspiron	Pièce détachée	15.00	40.00	0	\N	\N	NEUF	2	\N	\N	\N	\N	\N
188	Connecteur charge iPhone 11	Pièce détachée	8.00	25.00	-1	\N	\N	NEUF	2	\N	\N	\N	\N	\N
181	Batterie iPhone 11	Pièce détachée	12.00	35.00	-2	\N	\N	NEUF	2	\N	\N	\N	\N	\N
173	Écran iPhone 11 OEM	Pièce détachée	35.00	80.00	-2	\N	\N	NEUF	2	\N	\N	\N	\N	\N
192	Haut-parleur iPhone 11	Pièce détachée	7.00	22.00	-2	\N	\N	NEUF	2	\N	\N	\N	\N	\N
242	Diagnostic téléphone	Prestation	0.00	20.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
243	Diagnostic tablette	Prestation	0.00	25.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
244	Diagnostic PC portable	Prestation	0.00	30.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
245	Diagnostic MacBook	Prestation	0.00	35.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
246	Pose verre trempé téléphone	Prestation	0.00	5.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
247	Pose verre trempé tablette	Prestation	0.00	8.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
248	Pose coque	Prestation	0.00	3.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
249	Sauvegarde données téléphone	Prestation	0.00	30.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
250	Sauvegarde données PC	Prestation	0.00	40.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
251	Transfert données	Prestation	0.00	25.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
252	Déverrouillage iPhone	Prestation	0.00	25.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
253	Réinitialisation téléphone	Prestation	0.00	20.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
254	Réinstallation Windows	Prestation	0.00	49.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
255	Réinstallation macOS	Prestation	0.00	49.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
256	Nettoyage PC / ventilateur	Prestation	0.00	35.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
257	Mise à jour iOS / Android	Prestation	0.00	15.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
258	Mise à jour Windows / macOS	Prestation	0.00	20.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
259	Récupération données	Prestation	0.00	60.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
260	Antivirus / sécurité PC	Prestation	0.00	30.00	0	\N	\N	NEUF	1	\N	\N	\N	\N	\N
\.


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 286, true);


--
-- PostgreSQL database dump complete
--

\unrestrict walcDpqYcrjNk6r143pWALw3gRQFpeLRDrpzlJmviB2PoM92ItPMsTj3fkXcLS3

