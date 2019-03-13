@echo off
title CompBOT
color 0a
mode con: cols=130 lines=30
cls
:run
title CompBOT - Running
echo Starting bot...
node ".\bot-files\main.js"
title CompBOT - Stopped
echo Press any key to restart bot...
PAUSE > NUL
goto :run
