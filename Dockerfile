FROM osgeo/gdal:ubuntu-full-3.0.4

ENV DEBIAN_FRONTEND=noninteractive

RUN curl -sL https://deb.nodesource.com/setup_12.x | bash && \
    echo steam steam/question select "I AGREE" | debconf-set-selections && \
    echo steam steam/license note '' | debconf-set-selections && \
    dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y \
        software-properties-common \
        wget \
        curl \
        lftp \
        unzip \
        lib32gcc1 \
        ca-certificates \
        python3 \
        python3-dev \
        python3-pip \
    && \
    apt-add-repository ppa:ubuntugis/ppa && \
    apt-get update && \
    apt-get install -y \
        gdal-bin \
        libgdal-dev \
        python3-gdal \
        imagemagick \
        liblzo2-2 \
        libvorbis0a \
        libvorbisfile3 \
        libvorbisenc2 \
        libogg0 \
        libuchardet0 \
        nodejs \
        locales \
        libcurl4 \
        libc6-i386 \
        lib32stdc++6 \
        libssl1.0.0 \
        libssl-dev \
    && \
    export CPLUS_INCLUDE_PATH=/usr/include/gdal && \
    export C_INCLUDE_PATH=/usr/include/gdal && \
    pip3 install GDAL && \
    node -v && \
    apt-get autoremove -q -y && \
    rm -rf /var/lib/apt/lists/* && \
    locale-gen "en_US.UTF-8" && \
    export LC_ALL="en_US.UTF-8"

RUN cd /usr/local/src && \
    curl -o steamcmd_linux.tar.gz "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" && \
    tar -zxf steamcmd_linux.tar.gz && \
    rm steamcmd_linux.tar.gz && \
    mv /usr/local/src/steamcmd.sh /usr/local/bin/steamcmd && \
    mv /usr/local/src/linux32 /usr/local/bin/linux32 && \
    chmod +x /usr/local/bin/steamcmd && \
    curl -o master.tgz -L https://github.com/commenthol/gdal2tiles-leaflet/archive/master.tar.gz && \
	tar -xzf master.tgz && \
    rm master.tgz && \
    mkdir mikero && cd mikero && \
    curl -o mikero.tgz -L https://mikero.bytex.digital/api/download?filename=depbo-tools-0.8.07-linux-64bit.tgz && \
    tar --strip-components=1 -xzf mikero.tgz && \
    rm mikero.tgz && cd .. && \
    cp -r mikero/bin /usr/local && \
    cp -r mikero/lib /usr/local && \
    ldconfig

COPY --from=acemod/armake /usr/local/bin/armake /usr/local/bin/armake

RUN sed -i 's/name="memory" value="256MiB"/name="memory" value="8GB"/g' /etc/ImageMagick-6/policy.xml && \
    sed -i 's/name="map" value="512MiB"/name="map" value="16GB"/g' /etc/ImageMagick-6/policy.xml && \
    sed -i 's/name="width" value="16KP"/name="width" value="128KP"/g' /etc/ImageMagick-6/policy.xml && \
    sed -i 's/name="height" value="16KP"/name="height" value="128KP"/g' /etc/ImageMagick-6/policy.xml && \
    sed -i 's/name="area" value="128MB"/name="area" value="2GB"/g' /etc/ImageMagick-6/policy.xml && \
    sed -i 's/name="disk" value="1GiB"/name="disk" value="16GiB"/g' /etc/ImageMagick-6/policy.xml

ENTRYPOINT [ ]
