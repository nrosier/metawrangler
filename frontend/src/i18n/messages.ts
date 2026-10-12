/**
 * i18n message catalog — English (en) and Spanish (es)
 * Extensible for additional languages
 */

export type Locale = "en" | "es";

export const messages = {
  en: {
    // Navigation
    "nav.browse": "Browse",
    "nav.jobs": "Jobs",
    "nav.settings": "Settings",
    "nav.audit": "Audit Log",

    // Browse page
    "browse.title": "Browse",
    "browse.editButton": (count: number) => `Edit ${count} file${count !== 1 ? "s" : ""}`,
    "browse.selectAll": "Select all",
    "browse.deselectAll": "Deselect all",
    "browse.noMounts": "No mounts configured.",
    "browse.noFiles": "No MKV files here.",
    "browse.noFilesRecursive": "No MKV files found.",
    "browse.scanning": "Scanning…",
    "browse.folders": (count: number) => `${count} folder${count !== 1 ? "s" : ""}`,
    "browse.files": (count: number) => `${count} file${count !== 1 ? "s" : ""}`,
    "browse.filterPlaceholder": "Filter files…",
    "browse.recursiveLabel": "All files found here and in paths below this",
    "browse.selectFileLabel": "Select file",
    "browse.deselectFileLabel": "Deselect file",
    "browse.expandDetailsLabel": (name: string) => `Expand details for ${name}`,
    "browse.collapseDetailsLabel": (name: string) => `Collapse details for ${name}`,
    "browse.rescan": "Re-scan",
    "browse.selectAtLeast": "Select at least one file to edit",

    // Jobs page
    "jobs.title": "Jobs",
    "jobs.noJobs": "No jobs yet.",
    "jobs.created": "Created",
    "jobs.status": "Status",
    "jobs.files": "Files",
    "jobs.type": "Type",
    "jobs.viewDetails": (date: string) => `View details for job created ${date}`,

    // Job detail page
    "jobDetail.title": "Job",
    "jobDetail.back": "Back to jobs",
    "jobDetail.created": "Created",
    "jobDetail.user": "User",
    "jobDetail.filesProcessed": "Files",
    "jobDetail.progressLabel": (processed: number, total: number) =>
      `Progress: ${processed} of ${total} files processed`,
    "jobDetail.liveUpdatesActive": "Live updates active",
    "jobDetail.liveUpdatesFailed": "Live updates unavailable",
    "jobDetail.noFileData": "No file data yet…",
    "jobDetail.undo": "Undo",
    "jobDetail.undoTitle": "Undo all changes made by this job",
    "jobDetail.file": "File",
    "jobDetail.changes": "Changes",

    // Settings page
    "settings.title": "Settings",
    "settings.addMount": "Add mount",
    "settings.noMounts": "No mounts configured.",
    "settings.formTitle": (action: "Add" | "Edit") => `${action} mount`,
    "settings.displayName": "Display name",
    "settings.containerPath": "Container path",
    "settings.type": "Type",
    "settings.cancel": "Cancel",
    "settings.save": "Save",
    "settings.saving": "Saving…",
    "settings.remove": "Remove",
    "settings.edit": "Edit",
    "settings.reachable": "reachable",
    "settings.unreachable": "unreachable",
    "settings.dryRun": "dry-run",
    "settings.confirmRemove": (name: string) => `Remove mount "${name}"?`,

    // Status badges
    "status.pending": "Pending",
    "status.running": "Running",
    "status.done": "Done",
    "status.failed": "Failed",
    "status.partial": "Partial",
    "status.success": "Success",
    "status.skipped": "Skipped",

    // Audit log
    "audit.title": "Audit Log",
    "audit.noEntries": "No audit entries yet.",
    "audit.time": "Time",
    "audit.action": "Action",
    "audit.user": "User",
    "audit.detail": "Detail",
    "audit.scan": "Scan",
    "audit.edit": "Edit",
    "audit.undo": "Undo",
    "audit.mountAdded": "Mount added",
    "audit.mountRemoved": "Mount removed",
    "audit.mountUpdated": "Mount updated",
    "audit.viewJob": (action: string) => `View job details for ${action} action`,

    // Common
    "common.loading": "Loading…",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.muted": "muted",
  },
  es: {
    // Navigation
    "nav.browse": "Explorar",
    "nav.jobs": "Trabajos",
    "nav.settings": "Configuración",
    "nav.audit": "Registro de auditoría",

    // Browse page
    "browse.title": "Explorar",
    "browse.editButton": (count: number) =>
      `Editar ${count} archivo${count !== 1 ? "s" : ""}`,
    "browse.selectAll": "Seleccionar todo",
    "browse.deselectAll": "Deseleccionar todo",
    "browse.noMounts": "No hay montajes configurados.",
    "browse.noFiles": "No hay archivos MKV aquí.",
    "browse.noFilesRecursive": "No se encontraron archivos MKV.",
    "browse.scanning": "Escaneando…",
    "browse.folders": (count: number) =>
      `${count} carpeta${count !== 1 ? "s" : ""}`,
    "browse.files": (count: number) => `${count} archivo${count !== 1 ? "s" : ""}`,
    "browse.filterPlaceholder": "Filtrar archivos…",
    "browse.recursiveLabel": "Todos los archivos aquí y en las rutas debajo",
    "browse.selectFileLabel": "Seleccionar archivo",
    "browse.deselectFileLabel": "Deseleccionar archivo",
    "browse.expandDetailsLabel": (name: string) =>
      `Expandir detalles para ${name}`,
    "browse.collapseDetailsLabel": (name: string) =>
      `Contraer detalles para ${name}`,
    "browse.rescan": "Re-escanear",
    "browse.selectAtLeast": "Selecciona al menos un archivo para editar",

    // Jobs page
    "jobs.title": "Trabajos",
    "jobs.noJobs": "Sin trabajos aún.",
    "jobs.created": "Creado",
    "jobs.status": "Estado",
    "jobs.files": "Archivos",
    "jobs.type": "Tipo",
    "jobs.viewDetails": (date: string) =>
      `Ver detalles del trabajo creado ${date}`,

    // Job detail page
    "jobDetail.title": "Trabajo",
    "jobDetail.back": "Volver a trabajos",
    "jobDetail.created": "Creado",
    "jobDetail.user": "Usuario",
    "jobDetail.filesProcessed": "Archivos",
    "jobDetail.progressLabel": (processed: number, total: number) =>
      `Progreso: ${processed} de ${total} archivos procesados`,
    "jobDetail.liveUpdatesActive": "Actualizaciones en vivo activas",
    "jobDetail.liveUpdatesFailed": "Actualizaciones en vivo no disponibles",
    "jobDetail.noFileData": "Sin datos de archivo aún…",
    "jobDetail.undo": "Deshacer",
    "jobDetail.undoTitle": "Deshacer todos los cambios realizados por este trabajo",
    "jobDetail.file": "Archivo",
    "jobDetail.changes": "Cambios",

    // Settings page
    "settings.title": "Configuración",
    "settings.addMount": "Agregar montaje",
    "settings.noMounts": "No hay montajes configurados.",
    "settings.formTitle": (action: "Add" | "Edit") =>
      action === "Add" ? "Agregar montaje" : "Editar montaje",
    "settings.displayName": "Nombre para mostrar",
    "settings.containerPath": "Ruta del contenedor",
    "settings.type": "Tipo",
    "settings.cancel": "Cancelar",
    "settings.save": "Guardar",
    "settings.saving": "Guardando…",
    "settings.remove": "Eliminar",
    "settings.edit": "Editar",
    "settings.reachable": "accesible",
    "settings.unreachable": "no accesible",
    "settings.dryRun": "ejecución simulada",
    "settings.confirmRemove": (name: string) =>
      `¿Eliminar montaje "${name}"?`,

    // Status badges
    "status.pending": "Pendiente",
    "status.running": "En ejecución",
    "status.done": "Completado",
    "status.failed": "Fallido",
    "status.partial": "Parcial",
    "status.success": "Éxito",
    "status.skipped": "Omitido",

    // Audit log
    "audit.title": "Registro de auditoría",
    "audit.noEntries": "Sin entradas de auditoría aún.",
    "audit.time": "Hora",
    "audit.action": "Acción",
    "audit.user": "Usuario",
    "audit.detail": "Detalle",
    "audit.scan": "Escaneo",
    "audit.edit": "Edición",
    "audit.undo": "Deshacer",
    "audit.mountAdded": "Montaje agregado",
    "audit.mountRemoved": "Montaje eliminado",
    "audit.mountUpdated": "Montaje actualizado",
    "audit.viewJob": (action: string) =>
      `Ver detalles del trabajo para la acción ${action}`,

    // Common
    "common.loading": "Cargando…",
    "common.error": "Error",
    "common.retry": "Reintentar",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.muted": "atenuado",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];
