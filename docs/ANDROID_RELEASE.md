# Android release

## Estado actual

- `applicationId`: `com.pocha.mobile` (mantener estable).
- Nombre visible: `La Pocha`.
- Versión beta actual: `0.8.0+1`.
- `INTERNET` es el único permiso sensible utilizado.
- Release desactiva cleartext; el manifest debug puede usar HTTP local.
- Staging/release solo acepta una URL pública HTTPS. Socket.IO debe resolver a
  WSS sobre ese mismo origen; no se deben usar `localhost`, `127.0.0.1` ni
  `10.0.2.2` en esas builds.
- La beta staging puede identificarse como `La Pocha Staging` mediante
  `POCHA_APP_LABEL`; se conserva `applicationId=com.pocha.mobile` para no
  alterar la identidad productiva ni registrar otra app Firebase.
- El App Link `/join/<CODE>` usa `POCHA_LINK_HOST` y solo activa `autoVerify`
  con `POCHA_LINK_AUTO_VERIFY=true` cuando el dominio real está preparado.
- No hay signing debug como fallback en `release`.
- El script de build rechaza hosts locales y dominios reservados de ejemplo;
  una build staging siempre fuerza `POCHA_AUTH_MODE=external` y usa
  `La Pocha Staging` como etiqueta por defecto.

## Firma externa

Configurar en CI o en la máquina de release, nunca en Git:

```text
ANDROID_KEYSTORE_PATH
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

El keystore vive fuera del repositorio. Preferir Play App Signing y conservar
el upload key en un gestor de secretos.

## Artefactos

La forma reproducible de generar ambos artefactos y resolver la configuración de
Firebase para la aplicación exacta `com.pocha.mobile` es:

```powershell
$env:STAGING_API_URL = 'https://staging-api.example.com'
$env:STAGING_SOCKET_URL = 'https://staging-api.example.com'
$env:POCHA_LINK_HOST = 'staging.example.com'
$env:POCHA_LINK_AUTO_VERIFY = 'false'
$env:POCHA_APP_LABEL = 'La Pocha Staging'
.\tool\build_android_release.ps1 -Artifact both
```

El mismo script también puede ejecutarse desde la raíz del repositorio:

```powershell
.\mobile\tool\build_android_release.ps1 -Artifact both
```

Para analizar el tamaño del AAB:

```powershell
.\tool\build_android_release.ps1 -Artifact aab -AnalyzeSize
```

El script consulta el proyecto Firebase configurado, rechaza configuraciones
ambiguas y comprueba el `mobilesdk_app_id` y el package antes de compilar. No
guarda `google-services.json`, claves privadas ni tokens en el repositorio: la
app usa `FirebaseOptions` por `--dart-define`.

Si se necesita el archivo nativo para una integración Android alternativa, se
obtiene sin inventar valores desde Firebase CLI con el app ID exacto:

```powershell
firebase apps:list --project la-pocha-app
firebase apps:sdkconfig android <APP_ID_DE_com.pocha.mobile> --project la-pocha-app > google-services.json
```

El archivo descargado es local y no se commitea. Los SHA-1/SHA-256 se consultan
en Firebase Console → Project settings → Your apps → Android, o se calculan
con `keytool -list -v -keystore <upload-keystore>` para el certificado que se
usará realmente. Los OAuth Client IDs se consultan en Google Cloud Console →
APIs & Services → Credentials; el script selecciona el cliente web de tipo 3
del mismo proyecto para `serverClientId`.

También se pueden ejecutar las órdenes Flutter directamente:

```bash
flutter build apk --release --dart-define=STAGING_API_URL=https://staging-api.example.com --dart-define=STAGING_SOCKET_URL=https://staging-api.example.com
flutter build appbundle --release --dart-define=STAGING_API_URL=https://staging-api.example.com --dart-define=STAGING_SOCKET_URL=https://staging-api.example.com
```

La build debe recibir también la configuración pública de Firebase y los OAuth
Client IDs mediante `--dart-define` o secretos de CI. El endpoint de ejemplo no
es una dirección operativa: debe sustituirse por el host HTTPS real antes de
instalar la beta.

Los placeholders del manifest se inyectan como variables de entorno de Gradle:

```powershell
$env:POCHA_LINK_HOST = 'staging.example.com'
$env:POCHA_LINK_AUTO_VERIFY = 'false'
```

Activar `POCHA_LINK_AUTO_VERIFY=true` solo después de publicar
`https://staging.example.com/.well-known/assetlinks.json` con el fingerprint
del certificado de release.

Sin variables de firma, el resultado solo puede considerarse artefacto local de
QA y no artefacto listo para Play Console. El AAB es el artefacto de publicación;
el APK se usa para QA.

## Antes de publicar

- Confirmar target/min SDK y matriz de dispositivos.
- Revisar Data Safety, privacidad, cuenta de borrado y clasificación de contenido.
- Probar deep link HTTPS verificado en dispositivo.
- Instalar AAB en Internal testing; no publicar directamente a producción.
