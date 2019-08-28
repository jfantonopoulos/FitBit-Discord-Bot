module.exports = {
    jsonMemSize: (json) => {
        var totalBytes = 0;

        totalBytes = (json ? Buffer.from(JSON.stringify(json)).length : 0);

        function formatByteSize(bytes) {
            if (bytes < 1024) return bytes + " bytes";
            else if (bytes < 1048576) return (bytes / 1024).toFixed(3) + " KiB";
            else if (bytes < 1073741824) return (bytes / 1048576).toFixed(3) + " MiB";
            else return (bytes / 1073741824).toFixed(3) + " GiB";
        };

        return formatByteSize(totalBytes);
    },
    getTimeRange: () => {
        var currentDate = new Date();
        var prevHour = Math.max(currentDate.getHours() - 1, 0);
        var curHour = currentDate.getHours();
        if (curHour < 10)
            curHour = "0" + curHour;
        if (prevHour < 10)
            prevHour = "0" + prevHour;
        return { minTime: prevHour + ":00", maxTime: curHour + ":59" }
    }
}