# Partitura → RTTTL

`partitura_a_rtttl.py` convierte una partitura en una melodía RTTTL para el bloque
**Tocar RTTTL** (Zumbador). Con esta herramienta se hicieron las canciones de 31 Minutos de
`www/blocs&generateurs/mpr_canciones.js`. Solo necesita Python 3, sin instalar nada más.

## Paso a paso con una tablatura de Songsterr

```
python tools/rtttl/partitura_a_rtttl.py buscar "anacleto"
python tools/rtttl/partitura_a_rtttl.py descargar 3869622 0 anacleto.json
python tools/rtttl/partitura_a_rtttl.py ver anacleto.json --hasta 20
python tools/rtttl/partitura_a_rtttl.py convertir anacleto.json --compases 1-4,9-12 --nombre Anacleto --wav anacleto.wav
```

1. **buscar** muestra el id de cada canción y sus pistas. Conviene elegir la pista de **voz**
   (o flauta), porque tiene la melodía.
2. **descargar** guarda la pista en un `.json`. Avisa si la tablatura fue generada por IA.
3. **ver** muestra las notas de cada compás, numeradas (`3:G2/8` = 3.ª nota del compás, Sol,
   corchea). Sirve para elegir qué compases usar.
4. **convertir** genera el RTTTL de esos compases e informa duración y notas. Por defecto
   sube o baja octavas para que suene bien en el zumbador (`--transponer auto`). Con `--wav`
   guarda un sonido parecido al del zumbador para escucharla antes de probar en el robot.

Opciones de `convertir`:

| Opción | Para qué | Ejemplo |
|---|---|---|
| `--compases` | Compases a usar, en orden; se pueden repetir | `9-16,9-16` (coro 2 veces) |
| `--bpm` | Tempo; por defecto el de la pista | `--bpm 83` |
| `--transponer` | Semitonos a subir (12 = una octava) o `auto` | `--transponer 24` |
| `--corregir` | Cambiar una nota mal escrita en la tablatura: `compás.posición=nota`, con la posición que muestra `ver` | `--corregir 11.6=B6` |
| `--quitar-final` | Quitar las últimas N notas | `--quitar-final 3` |
| `--ultima` | Nueva duración de la última nota | `--ultima 2` (blanca) |
| `--wav` | Guardar el sonido | `--wav prueba.wav` |

## Notas escritas a mano (flauta, metalófono, etc.)

```
python tools/rtttl/partitura_a_rtttl.py texto "sol4/8 la4/8 si4/4. p/8 do5/2" --bpm 100 --nombre Prueba --wav prueba.wav
```

Cada nota es `nota+octava/duración`: `do5`, `sol#4`, `sib4` o `C5`, `F#4`; `p` = silencio.
La duración es 1, 2, 4, 8, 16 o 32 (4 = negra, 8 = corchea), con `.` si tiene punto; `4+8`
suma duraciones (nota ligada). Sin duración se toma negra. El Do central es `do4`.

## Revisar y escuchar un RTTTL

```
python tools/rtttl/partitura_a_rtttl.py validar "Anacleto:d=8,o=5,b=106:g,g,g,g,c6"
python tools/rtttl/partitura_a_rtttl.py wav "Anacleto:d=8,o=5,b=106:g,g,g,g,c6" prueba.wav
```

`validar` aplica las mismas reglas que la librería PlayRtttl: nombre de hasta 10 letras o
números, sin espacios, octavas 4 a 7, sin `e#` ni `b#`.

## Agregar la canción a la app

Agregar una línea en `www/blocs&generateurs/mpr_canciones.js`:

```js
['Texto en la lista', 'MPR_Nombre', 'Nombre:d=8,o=6,b=120:...'],
```

El identificador debe empezar con `MPR_`. Después: `python tools/probar.py` y F5 en la app.

## Recetas de las canciones de 31 Minutos

Con estos comandos se obtienen exactamente las melodías de `mpr_canciones.js`.
Fuentes y correcciones: ver `BITACORA.md` (2026-10-18).

| Canción | Songsterr (canción, pista) | `convertir ... ` |
|---|---|---|
| Yo nunca vi televisión (tema) | 24427, 2 | `--compases 1-9 --bpm 83 --transponer 12 --quitar-final 3 --nombre YoNuncaVi` |
| Yo nunca vi televisión (coro) | 24427, 2 | `--compases 10-17 --bpm 83 --transponer 0 --corregir 11.6=B6 --corregir 11.7=B6 --corregir 11.8=B6 --ultima 2 --nombre YoNuncaV2` |
| Bailan sin cesar | 5069183, 0 | `--compases 18-21,23-27 --bpm 130 --transponer 36 --nombre BailanSin` |
| Mi muñeca me habló | 3183773, 4 | `--compases 9-16,9-16 --bpm 196 --transponer 24 --corregir 9.3=D4 --corregir 13.3=D4 --nombre MiMuneca` |
| El dinosaurio Anacleto | 3869622, 0 | `--compases 1-4,9-12 --nombre Anacleto` |
| El dinosaurio Anacleto (coro) | 3869622, 0 | `--compases 36-43 --nombre Anacleto2` |

Las tablaturas de Songsterr pueden cambiar (nuevas revisiones); si una receta ya no da lo
mismo, revisar los compases con `ver`.

Songsterr no tiene una API pública: `buscar` y `descargar` usan la de su página web y pueden
dejar de funcionar. En ese caso se pueden escribir las notas a mano con `texto`.
