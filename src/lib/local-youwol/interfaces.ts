export interface HealthzResponse {
    status: 'py-youwol ok'
}
/**
 * This is now @youwol/local-youwol-client that owns this type.
 * It is here for backward compatibility.
 * Ideally, only 'EnvironmentStatusResponse' should be used.
 */
export type Label =
    | 'Label.DONE'
    | 'Label.INFO'
    | 'Label.STARTED'
    | 'Label.BASH'
    | 'Label.LOG_ABORT'
    | 'Label.EXCEPTION'
    | 'Label.FAILED'
    | 'EnvironmentStatusResponse'
    | 'PipelineStatusResponse'
    | 'PipelineStepStatusResponse'
    | 'PipelineStepEvent'
    | 'ProjectStatusResponse'
    | 'PackageDownloading'
    | 'ArtifactsResponse'
    | 'CdnResponse'
    | 'CdnStatusResponse'
    | 'CdnPackageResponse'
    | 'CheckUpdateResponse'
    | 'CheckUpdatesResponse'
    | 'DownloadEvent'
    | 'Label.PACKAGE_DOWNLOADING'
    | 'DownloadedPackageResponse'
    | 'PackageEventResponse'
    | 'ProjectsLoadingResults'
    | 'Label.PIPELINE_STEP_STATUS_PENDING'
    | 'Label.PIPELINE_STEP_RUNNING'
    | 'Label.RUN_PIPELINE_STEP'
    | 'HelmPackage'
    | 'Label.PROJECT_CREATING'
    | 'InstallBackendEvent'
    | 'BackendResponse'
    | 'Label.INSTALL_BACKEND_SH'
    | 'Label.START_BACKEND_SH'
    | 'DownloadBackendEvent'
    | 'StartBackendEvent'

export interface ContextMessage<T = unknown, TLabel = Label> {
    contextId: string
    level: 'INFO' | 'WARNING' | 'ERROR'
    text: string
    labels: TLabel[]
    parentContextId: string | undefined
    data: T
    attributes: { [key: string]: string }
    timestamp: number
}

export type GetFileContentResponse = string
