# Google Play Data Safety — borrador técnico

Este documento refleja la implementación actual de Android y sirve para
preparar el formulario de Google Play. No sustituye la revisión legal ni la
confirmación final de proveedores, retención y jurisdicción.

## Datos que usa la aplicación

| Categoría                         | Datos reales                                                                                  | Recopilación                         | Compartición técnica                                                             | Uso                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| Información personal / cuenta     | Username, display name, identificador interno y subject de Firebase                           | Sí, al crear o usar la cuenta        | Backend y PostgreSQL; Firebase recibe los datos de autenticación que corresponda | Identidad en mesa, perfil e historial  |
| Información personal / email      | Email solo cuando el usuario elige Email/Password; el backend actual no lo persiste en `User` | Sí, por Firebase Authentication      | Firebase como proveedor de autenticación                                         | Alta y acceso                          |
| Información de autenticación      | ID token de Firebase durante las peticiones y sesión guardada en Secure Storage               | Sí                                   | Backend por HTTPS; no se envía a analytics                                       | Autenticar API y WebSocket             |
| Actividad en la aplicación        | Partidas, modo, reglas, rondas, scores, resultados, ELO, historial, temporada y estadísticas  | Sí, en partidas online/ranked        | Backend, PostgreSQL y Redis efímero cuando es necesario                          | Jugar, reconectar, ranking e historial |
| Contenido generado por el usuario | Username/display name                                                                         | Sí                                   | Backend y respuestas de mesa; no hay chat                                        | Mostrar el nombre a otros jugadores    |
| Diagnósticos                      | Errores técnicos sanitizados en logs del backend                                              | Solo local/servidor operativo actual | No hay SDK externo de analytics o crash configurado                              | Operación y soporte                    |

## Datos que no recoge la implementación actual

No se solicitan ni almacenan deliberadamente ubicación precisa, contactos,
teléfono, fotos, audio, vídeo, salud, datos financieros, publicidad
personalizada, historial de navegación ni cartas privadas en analytics. No hay
chat entre usuarios. El token de sesión no se registra en logs.

## Cifrado y seguridad

- En tránsito: la build Android staging/release solo acepta API HTTPS y
  Socket.IO sobre WSS; Firebase usa su transporte seguro.
- En el dispositivo: el token se guarda con `flutter_secure_storage`.
- En reposo: el cifrado de PostgreSQL/Redis gestionados depende del proveedor
  que se contrate y debe confirmarse antes de completar Data Safety.
- Acceso: el backend verifica Firebase Admin, limita acciones y filtra las
  cartas privadas por jugador.

## Eliminación y conservación

La aplicación ofrece `DELETE /users/me`. El comportamiento actualmente
verificado anonimiza username/display name y la vinculación personal del perfil,
pero conserva resultados históricos agregados para no romper la integridad de
la clasificación. Tras una eliminación correcta también se limpian del
dispositivo el token, el nombre guardado, la partida local y las estadísticas e
historiales offline. Antes de Play hay que confirmar la eliminación/retención
de la cuenta en Firebase y de las copias de seguridad del proveedor.

`GET /users/me/export` entrega los datos propios de perfil, estadísticas e
historial sin tokens, passwords, cartas privadas ni datos innecesarios de
rivales.

## Decisiones que debe confirmar el responsable de Play

1. Si Firebase, hosting, PostgreSQL y Redis se declaran como proveedores que
   reciben datos en la definición de “compartir” de Play.
2. Plazos de retención de snapshots, eventos, resultados y backups.
3. Cifrado en reposo ofrecido por el proveedor gestionado.
4. URL pública de política de privacidad y mecanismo de solicitud de borrado.
5. Identidad legal, jurisdicción, contacto y clasificación de edad.

No marcar el formulario como final hasta completar esas decisiones con los
servicios reales de staging y la política legal publicada.
