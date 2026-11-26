# Launches Steam Blender 5.3.0 with MCP for Blender server auto-started on localhost:9876!
$BlenderExe = "D:\SteamLibrary\steamapps\common\Blender\blender.exe"
if (-not (Test-Path $BlenderExe)) {
  Write-Error "Blender not found at $BlenderExe"
  exit 1
}

$AutoStartPy = @'
import bpy

def _auto_start_mcp():
    try:
        if hasattr(bpy.ops, "blendermcp") and hasattr(bpy.ops.blendermcp, "start_server"):
            bpy.ops.blendermcp.start_server()
            print("[BlenderMCP] Auto-started MCP server on localhost:9876")
    except Exception as e:
        print("[BlenderMCP] Auto-start note:", e)
    return None

bpy.app.timers.register(_auto_start_mcp, first_interval=1.2)
'@

$PyPath = Join-Path $PSScriptRoot "_blender_autostart_mcp.py"
Set-Content -Path $PyPath -Encoding UTF8 -Value $AutoStartPy

Start-Process -FilePath $BlenderExe -ArgumentList @("--python", $PyPath)
Write-Output "Launched Blender 5.3.0 with BlenderMCP auto-starting on localhost:9876!"
