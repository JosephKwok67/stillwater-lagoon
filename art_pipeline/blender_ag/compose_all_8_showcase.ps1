Add-Type -AssemblyName System.Drawing

$prevDir = "I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag\previews"
$outDir  = "I:\antigravity cli\钓鱼大冒险\art_pipeline\blender_ag"

function New-Brush($hex) {
    return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Draw-Card($g, $imgPath, $x, $y, $w, $h, $caption, $accent = "#288479") {
    $sh = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 28, 22, 16))
    $g.FillRectangle($sh, $x + 4, $y + 5, $w, $h); $sh.Dispose()
    $bg = New-Brush "#ffffff"; $g.FillRectangle($bg, $x, $y, $w, $h); $bg.Dispose()

    $img = [System.Drawing.Image]::FromFile($imgPath)
    $imgH = $h - 36
    $dstAspect = [double]($w - 10) / [double]($imgH - 8)
    $srcAspect = [double]$img.Width / [double]$img.Height
    $cx = 0; $cy = 0; $cw = $img.Width; $ch = $img.Height
    if ($srcAspect -gt $dstAspect) {
        $nw = [int]($img.Height * $dstAspect); $cx = [int](($img.Width - $nw) / 2); $cw = $nw
    } else {
        $nh = [int]($img.Width / $dstAspect); $cy = [int](($img.Height - $nh) / 2); $ch = $nh
    }
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle ($x + 5), ($y + 5), ($w - 10), ($imgH - 8)), (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
    $img.Dispose()

    $f = New-Object System.Drawing.Font ("Microsoft YaHei", 12, [System.Drawing.FontStyle]::Bold)
    $b = New-Brush "#332c24"
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($caption, $f, $b, (New-Object System.Drawing.RectangleF $x, ($y + $imgH), $w, 34), $sf)
    $f.Dispose(); $b.Dispose(); $sf.Dispose()

    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($accent)), 2
    $g.DrawRectangle($pen, $x, $y, $w, $h); $pen.Dispose()
}

# 1. All 5 Baked Characters Sheet (1920 x 840: 5 cols x 2 rows = Front + 3/4)
$W = 1920; $H = 880
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$bg = New-Brush "#f3eee4"; $g.FillRectangle($bg, 0, 0, $W, $H); $bg.Dispose()
$tb = New-Brush "#24373a"; $g.FillRectangle($tb, 0, 0, $W, 82); $tb.Dispose()
$tf = New-Object System.Drawing.Font ("Microsoft YaHei", 21, [System.Drawing.FontStyle]::Bold)
$sf2 = New-Object System.Drawing.Font ("Microsoft YaHei", 11, [System.Drawing.FontStyle]::Regular)
$wb = New-Brush "#faf5eb"; $sb = New-Brush "#c4d6d4"
$g.DrawString("Antigravity Studio Edition · 全套 5 位角色烘焙精模总览（已热替换上线）", $tf, $wb, 36, 14)
$g.DrawString("全角色均完成 Blender 5.3 曲面精雕 + Cycles 1024px 手绘水粉&AO贴图烘焙 · 上排正面 / 下排 3/4 视角", $sf2, $sb, 38, 52)
$tf.Dispose(); $sf2.Dispose(); $wb.Dispose(); $sb.Dispose()

$chars = @(
    @{ id="player"; label="主角 · 草帽垂钓者" },
    @{ id="dog"; label="伴游小狗" },
    @{ id="npc_market"; label="阿莲 · 渔市老板娘" },
    @{ id="npc_artisan"; label="老周 · 渔具工匠" },
    @{ id="npc_lighthouse"; label="海伯 · 灯塔守望者" }
)
$margin = 30; $gap = 20
$cw = [int](($W - $margin * 2 - $gap * 4) / 5) # 356
$ch = 365
for ($i = 0; $i -lt 5; $i++) {
    $c = $chars[$i]
    $x = $margin + $i * ($cw + $gap)
    Draw-Card $g (Join-Path $prevDir "$($c.id)_front.png") $x 104 $cw $ch "$($c.label) · 正面" "#c84b34"
    Draw-Card $g (Join-Path $prevDir "$($c.id)_34.png")    $x 490 $cw $ch "$($c.label) · 3/4" "#288479"
}
$bmp.Save((Join-Path $outDir "AG_ALL_5_CHARACTERS_BAKED.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# 2. All 3 Baked Walk-In Cottages Sheet (1920 x 1340: 3 rows x 3 cols = Ext / Cutaway / 52° TopDown)
$W2 = 1920; $H2 = 1360
$bmp2 = New-Object System.Drawing.Bitmap $W2, $H2
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$bg2 = New-Brush "#f3eee4"; $g2.FillRectangle($bg2, 0, 0, $W2, $H2); $bg2.Dispose()
$tb2 = New-Brush "#24373a"; $g2.FillRectangle($tb2, 0, 0, $W2, 82); $tb2.Dispose()
$tf = New-Object System.Drawing.Font ("Microsoft YaHei", 21, [System.Drawing.FontStyle]::Bold)
$sf2 = New-Object System.Drawing.Font ("Microsoft YaHei", 11, [System.Drawing.FontStyle]::Regular)
$wb = New-Brush "#faf5eb"; $sb = New-Brush "#c4d6d4"
$g2.DrawString("Antigravity Studio Edition · 全套 3 栋走入式房屋 & 室内烘焙精模总览（已热替换上线）", $tf, $wb, 36, 14)
$g2.DrawString("参考 Codex Image 2.5 分镜板建模 + Cycles 2048px 水粉&AO烘焙 · 全兼容 Door_Hinge / Roof_Cutaway / Anchor_Aquarium", $sf2, $sb, 38, 52)
$tf.Dispose(); $sf2.Dispose(); $wb.Dispose(); $sb.Dispose()

$houses = @(
    @{ id="house_player"; label="我的临水红顶小屋"; accent="#c84b34" },
    @{ id="house_artisan"; label="老周渔具工坊"; accent="#288479" },
    @{ id="house_neighbor_east"; label="东岸海景木屋"; accent="#c98028" }
)
$pw = [int](($W2 - 36 * 2 - 24 * 2) / 3) # 600
$ph = 395
for ($r = 0; $r -lt 3; $r++) {
    $h = $houses[$r]
    $y = 104 + $r * ($ph + 20)
    Draw-Card $g2 (Join-Path $prevDir "$($h.id)_ext.png")   36                 $y $pw $ph "$($h.label) · 外观" $h.accent
    Draw-Card $g2 (Join-Path $prevDir "$($h.id)_int34.png") (36 + $pw + 24)    $y $pw $ph "$($h.label) · 室内剖面" $h.accent
    Draw-Card $g2 (Join-Path $prevDir "$($h.id)_top52.png") (36 + ($pw+24)*2)  $y $pw $ph "$($h.label) · 52° 实机视角" $h.accent
}
$bmp2.Save((Join-Path $outDir "AG_ALL_3_HOUSES_BAKED.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose(); $bmp2.Dispose()
Write-Host "Composed AG_ALL_5_CHARACTERS_BAKED.png & AG_ALL_3_HOUSES_BAKED.png!"
