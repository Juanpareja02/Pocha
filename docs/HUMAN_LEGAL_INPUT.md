# Human legal input

Este documento contiene únicamente los datos que debe aportar manualmente el
responsable antes de Google Play Internal Testing o de una publicación pública.
No incluye contraseñas, tokens, keystores ni credenciales técnicas.

## Datos necesarios

| Qué necesito                                         | Dónde se obtiene                                         | Dónde configurarlo                                              | Cómo comprobarlo                                                |
| ---------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Nombre legal del desarrollador o empresa             | Registro o identidad legal del responsable               | `docs/PRIVACY_POLICY_ES.md`, `docs/TERMS_ES.md` y ficha de Play | El mismo nombre aparece en los documentos y Play Console        |
| Jurisdicción y dirección legal                       | Datos fiscales/legales del responsable                   | Política y Términos                                             | Revisión legal del texto publicado                              |
| Email de contacto y soporte                          | Buzón que se atenderá realmente                          | Política, Términos, ficha y Play Console                        | Recibe un mensaje de prueba y no es un placeholder              |
| URL HTTPS de política de privacidad                  | Dominio que controle el responsable                      | Play Console y `LEGAL_PRIVACY_URL`                              | Responde 200 por HTTPS y contiene identidad/contacto            |
| URL HTTPS de Términos de uso                         | Dominio que controle el responsable                      | Ficha/Play Console y `LEGAL_TERMS_URL`                          | Responde 200 por HTTPS y corresponde a la versión publicada     |
| URL o procedimiento de eliminación                   | Endpoint/página o email de soporte que se vaya a ofrecer | Play Console, política y ayuda de la app                        | Permite iniciar el borrado y explica la anonimización histórica |
| Política de retención de historial y backups         | Decisión del responsable junto al proveedor              | Política de privacidad y Data Safety                            | Coincide con PostgreSQL, Redis, Firebase y backups reales       |
| Declaración de anuncios y clasificación de contenido | Revisión del producto y Play Console                     | `docs/GOOGLE_PLAY_RELEASE.md` y Play Console                    | La ficha coincide con lo que contiene la build                  |

## Reglas de configuración

- Sustituir todos los placeholders antes de presentar la app.
- No poner estos datos en código si solo son URLs o textos de la ficha; las
  URLs públicas deben ser HTTPS y estar bajo control del responsable.
- No pegar secretos técnicos en este documento, Git o conversaciones.
- La aprobación legal y la cumplimentación final de Data Safety son manuales.
