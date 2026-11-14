FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/convolvex
COPY . .
RUN pip install --no-cache-dir . && python scripts/build_native.py && pip install --no-cache-dir --force-reinstall --no-deps .
RUN useradd --create-home --uid 10001 scientist && mkdir /data && chown scientist:scientist /data
USER scientist
ENV CONVOLVEX_DATA=/data OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
EXPOSE 8765
CMD ["convolvex","serve","--host","0.0.0.0"]
